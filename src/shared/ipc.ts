import type { Badge } from './badges'
import type { Settings } from './settings'
import type { NewSite, Result, Site, SitePatch } from './site'
import type { WritingAction } from './writing'

/** Channel names shared by main, preload and renderer. */
export const IPC = {
  appInfo: 'app:info',
  sitesList: 'sites:list',
  sitesAdd: 'sites:add',
  sitesUpdate: 'sites:update',
  sitesRemove: 'sites:remove',
  sitesReorder: 'sites:reorder',
  sitesChanged: 'sites:changed',
  viewOpen: 'view:open',
  viewHome: 'view:home',
  viewReload: 'view:reload',
  viewOverlay: 'view:overlay',
  viewActive: 'view:active',
  viewStatus: 'view:status',
  siteMenu: 'site:menu',
  siteCommand: 'site:command',
  /** Sent by a site page when one of its notifications is clicked. */
  siteFocusRequest: 'site:focus-request',
  viewBadge: 'view:badge',
  uiCommand: 'ui:command',
  appMenu: 'app:menu',
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  aiKeyStatus: 'ai:key-status',
  aiKeySet: 'ai:key-set',
  aiTest: 'ai:test',
  /** Main → writing panel: the panel's whole state, sent on every change. */
  writerState: 'writer:state',
  /** Writing panel → main. */
  writerRun: 'writer:run',
  writerApply: 'writer:apply',
  writerCopy: 'writer:copy',
  writerStop: 'writer:stop',
  writerClose: 'writer:close',
  writerSettings: 'writer:settings',
  writerResize: 'writer:resize'
} as const

export interface AiKeyStatus {
  saved: boolean
  /** False without a system keyring; Hub then won't store a key. */
  canStore: boolean
}

/**
 * What the writing panel shows. `rewrite` works on selected text; `draft` writes into an empty
 * text box. `ask` waits for the person to type an instruction.
 */
export interface WriterState {
  mode: 'rewrite' | 'draft'
  phase: 'ask' | 'working' | 'done' | 'error'
  label: string
  result: string
  error?: string
  /** The router rejected the key or none is saved: offer Settings. */
  needsSettings: boolean
  /** The text came from an editable field, so the answer can be put back. */
  canApply: boolean
  /** Laid out as a full-width bottom sheet (narrow windows). */
  sheet: boolean
}

export type WriterRun = { action: WritingAction } | { followUp: string } | { retry: true }

/** The API the writing panel's preload exposes on `window.writer`. */
export interface WriterApi {
  onState(listener: (state: WriterState) => void): () => void
  run(request: WriterRun): void
  apply(): void
  copy(): void
  stop(): void
  close(): void
  openSettings(): void
  /** Reports the panel content's natural height, so main can size the view to fit. */
  resize(height: number): void
}

/** Requests from the window menu (keyboard shortcuts) that the UI carries out. */
export type UiCommand = 'quick-switch' | 'add-site' | 'settings'

/** Actions from a sidebar icon's right-click menu that the UI carries out. */
export type SiteCommand = 'edit' | 'remove'

/**
 * Load state of a site's page. `error` and `crashed` hide the page so the UI can explain;
 * `sleeping` means the page was closed to save memory and reloads when opened.
 */
export interface ViewStatus {
  id: string
  state: 'loading' | 'ready' | 'error' | 'crashed' | 'sleeping'
  message?: string
}

export interface AppInfo {
  version: string
}

/** The API the preload exposes on `window.hub`. */
export interface HubApi {
  appInfo(): Promise<AppInfo>
  sites: {
    list(): Promise<Site[]>
    add(input: NewSite): Promise<Result<Site>>
    update(id: string, patch: SitePatch): Promise<Result<Site>>
    remove(id: string): Promise<boolean>
    reorder(ids: string[]): Promise<void>
    /** Fires with the full list whenever it changes. Returns an unsubscribe function. */
    onChanged(listener: (sites: Site[]) => void): () => void
  }
  settings: {
    get(): Promise<Settings>
    update(patch: Partial<Settings>): Promise<Settings>
  }
  ai: {
    keyStatus(): Promise<AiKeyStatus>
    /** Saves the router key encrypted, or removes it with null. */
    setKey(key: string | null): Promise<Result<AiKeyStatus>>
    /** Sends one tiny request with the saved address, key and model. */
    test(): Promise<Result<true>>
  }
  /** Opens the window menu at a point in the window (the title bar's ☰ button). */
  showAppMenu(at: { x: number; y: number }): Promise<void>
  /** Fires when a keyboard shortcut asks the UI to do something. */
  onCommand(listener: (command: UiCommand) => void): () => void
  view: {
    /** Shows a site's page, loading it on first open. */
    open(id: string): Promise<void>
    /** Hides any page and shows the dashboard. */
    home(): Promise<void>
    reload(id: string): Promise<void>
    /** Pages draw above the UI, so dialogs ask for the active page to be hidden while open. */
    setOverlay(open: boolean): Promise<void>
    /** Fires with the visible site's id, or null for the dashboard. */
    onActive(listener: (id: string | null) => void): () => void
    onStatus(listener: (status: ViewStatus) => void): () => void
    /** Shows the native right-click menu for a sidebar icon. */
    onBadge(listener: (id: string, badge: Badge) => void): () => void
    showSiteMenu(id: string): Promise<void>
    onSiteCommand(listener: (id: string, command: SiteCommand) => void): () => void
  }
}
