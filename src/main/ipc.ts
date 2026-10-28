import { app, ipcMain } from 'electron'
import { z } from 'zod'
import { IPC, type AppInfo } from '@shared/ipc'
import { settingsSchema, type Settings } from '@shared/settings'
import type { SettingsStore } from './settings'
import type { SiteManager } from './siteManager'
import type { SiteStore } from './store'

// The renderer is trusted code, but IPC arguments are still checked at the boundary.
const newSite = z.object({ name: z.string(), url: z.string() })
const patch = z
  .object({
    name: z.string(),
    url: z.string(),
    keepAlive: z.boolean(),
    notifications: z.boolean()
  })
  .partial()
const id = z.string().min(1)

export function registerIpc(
  store: SiteStore,
  manager: () => SiteManager | undefined,
  /** Called after any change to the saved sites. */
  broadcast: () => void
): void {
  ipcMain.handle(IPC.appInfo, (): AppInfo => ({ version: app.getVersion() }))
  ipcMain.handle(IPC.sitesList, () => store.list())

  ipcMain.handle(IPC.sitesAdd, (_e, input: unknown) => {
    const result = store.add(newSite.parse(input))
    if (result.ok) broadcast()
    return result
  })

  ipcMain.handle(IPC.sitesUpdate, (_e, siteId: unknown, changes: unknown) => {
    const parsed = patch.parse(changes)
    // exactOptionalPropertyTypes: drop keys zod left as undefined.
    const clean = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined))
    const parsedId = id.parse(siteId)
    const before = store.get(parsedId)?.url
    const result = store.update(parsedId, clean)
    if (result.ok) {
      if (result.value.url !== before) manager()?.navigateHome(parsedId)
      if (clean['keepAlive'] === true) manager()?.ensureLoaded(parsedId)
      broadcast()
    }
    return result
  })

  ipcMain.handle(IPC.sitesRemove, async (_e, siteId: unknown) => {
    const parsed = id.parse(siteId)
    const removed = store.remove(parsed)
    if (removed) {
      await manager()?.forget(parsed)
      broadcast()
    }
    return removed
  })

  ipcMain.handle(IPC.sitesReorder, (_e, ids: unknown) => {
    store.reorder(z.array(id).parse(ids))
    broadcast()
  })

  ipcMain.handle(IPC.viewOpen, (_e, siteId: unknown) => manager()?.open(id.parse(siteId)))
  ipcMain.handle(IPC.viewHome, () => manager()?.home())
  ipcMain.handle(IPC.viewReload, (_e, siteId: unknown) => manager()?.reload(id.parse(siteId)))
  ipcMain.handle(IPC.siteMenu, (_e, siteId: unknown) => manager()?.showSiteMenu(id.parse(siteId)))
  ipcMain.handle(IPC.viewOverlay, (_e, open: unknown) =>
    manager()?.setOverlay(z.boolean().parse(open))
  )
}

export function registerSettingsIpc(
  settings: SettingsStore,
  apply: (settings: Settings) => void
): void {
  ipcMain.handle(IPC.settingsGet, () => settings.get())
  ipcMain.handle(IPC.settingsUpdate, (_e, patch: unknown) => {
    const parsed = settingsSchema.partial().parse(patch)
    const clean = Object.fromEntries(Object.entries(parsed).filter(([, v]) => v !== undefined))
    const next = settings.update(clean)
    apply(next)
    return next
  })
}
