import {
  desktopCapturer,
  session,
  shell,
  WebContentsView,
  type BrowserWindow,
  type Session
} from 'electron'
import { join } from 'node:path'
import { parseBadge, type Badge } from '@shared/badges'
import type { SiteCommand, ViewStatus } from '@shared/ipc'
import { popupDecision } from '@shared/links'
import type { Site } from '@shared/site'
import { fetchIcon } from './favicon'
import { attachPageMenu, showSiteMenu } from './menus'
import { SleepScheduler } from './sleep'
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
  badge(id: string, badge: Badge): void
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
  private readonly badges = new Map<string, Badge>()
  private readonly sleeper = new SleepScheduler()
  private activeId: string | null = null
  private overlay = false
  private sleepAfterMs = 30 * 60_000
  private sleepTimer: NodeJS.Timeout | undefined

  constructor(
    private readonly win: BrowserWindow,
    private readonly store: SiteStore,
    private readonly events: ManagerEvents
  ) {
    this.setSleepAfter(this.sleepAfterMs)

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
    if (this.activeId) this.sleeper.touch(this.activeId)
    this.sleeper.touch(id)
    this.activeId = id
    this.sync()
    if (view.getVisible()) view.webContents.focus()
    this.events.active(id)
  }

  home(): void {
    if (this.activeId) this.sleeper.touch(this.activeId)
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

  /** Idle time before a background page is put to sleep; 0 = never. */
  setSleepAfter(ms: number): void {
    this.sleepAfterMs = ms
    clearInterval(this.sleepTimer)
    if (ms <= 0) return
    // Check a few times per period so pages sleep close to the limit, at most once a minute.
    const every = Math.min(60_000, Math.max(500, ms / 4))
    this.sleepTimer = setInterval(() => this.sleepIdle(), every)
    this.sleepTimer.unref()
  }

  /** Loads keep-alive sites in the background so their notifications arrive from the start. */
  startBackground(): void {
    for (const site of this.store.list()) if (site.keepAlive) this.ensureLoaded(site.id)
  }

  /** Loads a site's page without showing it. */
  ensureLoaded(id: string): void {
    const site = this.store.get(id)
    if (site && !this.views.has(id)) this.create(site)
  }

  /** Closes a background page to free memory. Opening the site loads it again. */
  sleep(id: string): void {
    if (id === this.activeId || !this.views.has(id)) return
    this.close(id)
    this.sleeper.forget(id)
    const status: ViewStatus = { id, state: 'sleeping' }
    this.statuses.set(id, status)
    this.events.status(status)
  }

  showSiteMenu(id: string): void {
    const ids = this.store.list().map((s) => s.id)
    showSiteMenu(this.win, {
      canMoveUp: ids.indexOf(id) > 0,
      canMoveDown: ids.indexOf(id) < ids.length - 1,
      onMove: (step) => this.move(id, step),
      canSleep: this.views.has(id) && id !== this.activeId,
      onSleep: () => this.sleep(id),
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

  reloadActive(ignoreCache: boolean): void {
    const wc = this.activeContents()
    if (!wc) return
    if (ignoreCache) wc.reloadIgnoringCache()
    else this.reload(this.activeId ?? '')
  }

  /** Zooms the visible site (or the dashboard). `0` resets. */
  zoom(direction: -1 | 0 | 1): void {
    const wc = this.activeContents() ?? this.win.webContents
    const level = direction === 0 ? 0 : wc.getZoomLevel() + direction * 0.5
    wc.setZoomLevel(Math.max(-3, Math.min(4, level)))
  }

  history(step: -1 | 1): void {
    const nav = this.activeContents()?.navigationHistory
    if (step < 0 && nav?.canGoBack()) nav.goBack()
    if (step > 0 && nav?.canGoForward()) nav.goForward()
  }

  /** Opens the next or previous site in sidebar order, wrapping around. Home counts as a stop. */
  cycle(step: -1 | 1): void {
    const ids = this.store.list().map((s) => s.id)
    if (ids.length === 0) return
    const stops: (string | null)[] = [null, ...ids]
    const at = stops.indexOf(this.activeId)
    const next = stops[(at + step + stops.length) % stops.length] ?? null
    if (next) this.open(next)
    else this.home()
  }

  toggleDevTools(): void {
    const wc = this.activeContents() ?? this.win.webContents
    if (wc.isDevToolsOpened()) wc.closeDevTools()
    else wc.openDevTools({ mode: 'detach' })
  }

  /** Moves a site one place up or down in the sidebar. */
  move(id: string, step: -1 | 1): void {
    const ids = this.store.list().map((s) => s.id)
    const from = ids.indexOf(id)
    const to = from + step
    if (from < 0 || to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to] ?? id, id]
    this.store.reorder(ids)
    this.events.sitesChanged()
  }

  private activeContents(): Electron.WebContents | undefined {
    return this.activeId ? this.views.get(this.activeId)?.webContents : undefined
  }

  /** Unread badges of loaded pages. */
  allBadges(): Iterable<Badge> {
    return this.badges.values()
  }

  /** The site whose page (or popup opened from it) is this WebContents, if any. */
  siteIdFor(wc: Electron.WebContents): string | undefined {
    for (const [id, view] of this.views) {
      if (view.webContents === wc || wc.session === view.webContents.session) return id
    }
    return undefined
  }

  /** Closes a site's page. Its session (and login) survives. */
  close(id: string): void {
    const view = this.views.get(id)
    if (!view) return
    this.setBadge(id, null)
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
    this.configureSession(view.webContents.session, site.id)

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

    wc.on('page-title-updated', (_e, title) => this.setBadge(id, parseBadge(title)))

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

  private sleepIdle(): void {
    const due = this.sleeper.due(this.views.keys(), {
      activeId: this.activeId,
      afterMs: this.sleepAfterMs,
      keepAlive: (id) => this.store.get(id)?.keepAlive ?? false
    })
    for (const id of due) this.sleep(id)
  }

  private setBadge(id: string, badge: Badge): void {
    if ((this.badges.get(id) ?? null) === badge) return
    if (badge === null) this.badges.delete(id)
    else this.badges.set(id, badge)
    this.events.badge(id, badge)
  }

  /** One session per site, so `siteId` is fixed for the session's lifetime. */
  private configureSession(ses: Session, siteId: string): void {
    if (this.configured.has(ses)) return
    this.configured.add(ses)
    const allowed = (permission: string): boolean =>
      permission === 'notifications'
        ? (this.store.get(siteId)?.notifications ?? false)
        : ALLOWED_PERMISSIONS.has(permission)
    ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed(permission)))
    ses.setPermissionCheckHandler((_wc, permission) => allowed(permission))
    ses.registerPreloadScript({ type: 'frame', filePath: join(__dirname, '../preload/site.js') })
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
