import type { NewSite, Result, Site, SitePatch } from './site'

/** Channel names shared by main, preload and renderer. */
export const IPC = {
  appInfo: 'app:info',
  sitesList: 'sites:list',
  sitesAdd: 'sites:add',
  sitesUpdate: 'sites:update',
  sitesRemove: 'sites:remove',
  sitesReorder: 'sites:reorder',
  sitesChanged: 'sites:changed'
} as const

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
}
