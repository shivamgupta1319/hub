import type { NewSite, Result, Site, SitePatch } from './site'

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
  siteCommand: 'site:command'
} as const

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
    showSiteMenu(id: string): Promise<void>
    onSiteCommand(listener: (id: string, command: SiteCommand) => void): () => void
  }
}
