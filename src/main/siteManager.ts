import {
  desktopCapturer,
  session,
  shell,
  WebContentsView,
  type BrowserWindow,
  type Session
} from 'electron'
import type { SiteCommand, ViewStatus } from '@shared/ipc'
import { popupDecision } from '@shared/links'
import type { Site } from '@shared/site'
import { fetchIcon } from './favicon'
import { attachPageMenu, showSiteMenu } from './menus'
import type { SiteStore } from './store'

/** Must match --dock-width in the renderer. */
export const DOCK_WIDTH = 64

// Granted without asking: what chat, mail and meeting apps need. Everything else is denied.
const ALLOWED_PERMISSIONS = new Set([
  'notifications',
  'media',
  'display-capture',
  'fullscreen',
  'pointerLock',
  'clipboard-sanitized-write'
])

export interface ManagerEvents {
  active(id: string | null): void
  status(status: ViewStatus): void
  /** A site's saved details changed (e.g. its icon). */
  sitesChanged(): void
  command(id: string, command: SiteCommand): void
}

/** Each site gets its own persistent session, so logins never leak between sites. */
export function partitionFor(siteId: string): string {
  return `persist:site-${siteId}`
}

/** Owns one WebContentsView per opened site and decides which one is on screen. */
export class SiteManager {
  private readonly views = new Map<string, WebContentsView>()
  private readonly statuses = new Map<string, ViewStatus>()
  private readonly configured = new WeakSet<Session>()
  private activeId: string | null = null
  private overlay = false

  constructor(
    private readonly win: BrowserWindow,
    private readonly store: SiteStore,
    private readonly events: ManagerEvents
  ) {
    const relayout = (): void => this.layout()
    win.on('resize', relayout)
    win.on('maximize', relayout)
    win.on('unmaximize', relayout)
    win.on('enter-full-screen', relayout)
    win.on('leave-full-screen', relayout)
  }

  open(id: string): void {
    const site = this.store.get(id)
    if (!site) return
    const view = this.views.get(id) ?? this.create(site)
    this.activeId = id
    this.sync()
    if (view.getVisible()) view.webContents.focus()
    this.events.active(id)
  }

  home(): void {
    this.activeId = null
    this.sync()
    this.win.webContents.focus()
    this.events.active(null)
  }

  reload(id: string): void {
    const view = this.views.get(id)
    if (!view) return this.open(id)
    const site = this.store.get(id)
    // After a crash or a failed first load there may be nothing to reload, so load the saved URL.
    const current = view.webContents.getURL()
    if (current && this.statuses.get(id)?.state !== 'crashed') view.webContents.reload()
    else if (site) void view.webContents.loadURL(site.url).catch(() => undefined)
  }

  /** Loads the site's saved address again, e.g. after it was edited. */
  navigateHome(id: string): void {
    const site = this.store.get(id)
    const view = this.views.get(id)
    if (site && view) void view.webContents.loadURL(site.url).catch(() => undefined)
  }

  setOverlay(open: boolean): void {
    this.overlay = open
    this.sync()
  }

  showSiteMenu(id: string): void {
    showSiteMenu(this.win, {
      pageUrl: this.views.get(id)?.webContents.getURL() || this.store.get(id)?.url,
      onReload: () => this.reload(id),
      onCommand: (command) => this.events.command(id, command)
    })
  }

  /** Closes a site's page and deletes its cookies and storage, signing it out. */
  async forget(id: string): Promise<void> {
    this.close(id)
    const ses = session.fromPartition(partitionFor(id))
    await ses.clearStorageData()
    await ses.clearCache()
  }

  /** Closes a site's page. Its session (and login) survives. */
  close(id: string): void {
    const view = this.views.get(id)
    if (!view) return
    this.win.contentView.removeChildView(view)
    view.webContents.close()
    this.views.delete(id)
    this.statuses.delete(id)
    if (this.activeId === id) this.home()
  }

  private create(site: Site): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        partition: partitionFor(site.id),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: true
      }
    })
    view.setBackgroundColor('#ffffff')
    view.setVisible(false)
    this.win.contentView.addChildView(view)
    this.views.set(site.id, view)
    this.configureSession(view.webContents.session)

    const wc = view.webContents
    const id = site.id
    const siteUrl = (): string => this.store.get(id)?.url ?? site.url

    wc.setWindowOpenHandler(({ url }) => {
      const decision = popupDecision(url, siteUrl())
      if (decision === 'external') void shell.openExternal(url)
      if (decision !== 'in-app') return { action: 'deny' }
      return {
        action: 'allow',
        overrideBrowserWindowOptions: { width: 760, height: 720, autoHideMenuBar: true }
      }
    })
    // Popups (sign-in, pop-out compose) follow the same rules for their own links.
    wc.on('did-create-window', (child) => {
      child.webContents.setWindowOpenHandler(({ url }) => {
        if (popupDecision(url, siteUrl()) === 'external') void shell.openExternal(url)
        return { action: 'deny' }
      })
    })

    attachPageMenu(wc, this.win)

    // Save the icon once per full navigation (e.g. sign-in page → inbox). Updates within a page
    // are usually unread-count variants, which belong in a badge rather than the saved icon.
    let iconSaved = false
    wc.on('did-navigate', () => {
      iconSaved = false
    })
    const saveIcon = (url: string): void => {
      if (iconSaved) return
      iconSaved = true
      void fetchIcon(wc.session, url).then((dataUrl) => {
        if (dataUrl && this.store.setIcon(id, dataUrl)) this.events.sitesChanged()
        else if (!dataUrl) iconSaved = false
      })
    }
    wc.on('page-favicon-updated', (_e, favicons) => {
      const [first] = favicons
      if (first) saveIcon(first)
    })
    wc.on('did-finish-load', () => {
      // Pages that declare no icon usually still serve one at the conventional path.
      if (!iconSaved && !this.store.get(id)?.iconDataUrl) {
        try {
          saveIcon(new URL('/favicon.ico', wc.getURL()).href)
        } catch {
          // not an http(s) page; nothing to fetch
        }
      }
    })

    wc.on('did-start-loading', () => this.setStatus({ id, state: 'loading' }))
    wc.on('did-stop-loading', () => {
      const state = this.statuses.get(id)?.state
      if (state !== 'error' && state !== 'crashed') this.setStatus({ id, state: 'ready' })
    })
    wc.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
      // -3 is ERR_ABORTED: a navigation replaced by another one, not a real failure.
      if (!isMainFrame || code === -3) return
      this.setStatus({ id, state: 'error', message: describeLoadError(code, description) })
    })
    wc.on('render-process-gone', (_e, details) => {
      if (details.reason === 'clean-exit') return
      this.setStatus({ id, state: 'crashed' })
    })

    this.layout()
    void wc.loadURL(site.url).catch(() => undefined) // failures arrive via did-fail-load
    return view
  }

  private configureSession(ses: Session): void {
    if (this.configured.has(ses)) return
    this.configured.add(ses)
    ses.setPermissionRequestHandler((_wc, permission, callback) =>
      callback(ALLOWED_PERMISSIONS.has(permission))
    )
    ses.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission))
    // On Wayland, getSources opens the desktop's own screen picker and returns the choice.
    ses.setDisplayMediaRequestHandler((_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen', 'window'] })
        .then(([source]) => callback(source ? { video: source } : {}))
        .catch(() => callback({}))
    })
  }

  private setStatus(status: ViewStatus): void {
    const prev = this.statuses.get(status.id)
    if (prev?.state === status.state && prev.message === status.message) return
    this.statuses.set(status.id, status)
    this.sync()
    this.events.status(status)
  }

  /** Shows only the active page, and only when it has something to show and no dialog is open. */
  private sync(): void {
    for (const [id, view] of this.views) {
      const state = this.statuses.get(id)?.state
      const healthy = state !== 'error' && state !== 'crashed'
      view.setVisible(id === this.activeId && !this.overlay && healthy)
    }
  }

  private layout(): void {
    const { width, height } = this.win.getContentBounds()
    const bounds = { x: DOCK_WIDTH, y: 0, width: Math.max(0, width - DOCK_WIDTH), height }
    for (const view of this.views.values()) view.setBounds(bounds)
  }
}

function describeLoadError(code: number, description: string): string {
  switch (description) {
    case 'ERR_INTERNET_DISCONNECTED':
      return 'You’re offline. Check your connection, then try again.'
    case 'ERR_NAME_NOT_RESOLVED':
      return 'The address couldn’t be found. Check it’s spelled correctly.'
    case 'ERR_CONNECTION_REFUSED':
      return 'The site refused the connection. If it runs on this computer, make sure it’s started.'
    case 'ERR_CONNECTION_TIMED_OUT':
    case 'ERR_TIMED_OUT':
      return 'The site took too long to respond.'
    case 'ERR_CERT_AUTHORITY_INVALID':
    case 'ERR_CERT_COMMON_NAME_INVALID':
    case 'ERR_CERT_DATE_INVALID':
      return 'The site’s security certificate isn’t valid, so Hub didn’t open it.'
    default:
      return `The page couldn’t load (${description || `error ${code}`}).`
  }
}
