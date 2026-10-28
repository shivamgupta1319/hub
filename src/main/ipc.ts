import { app, ipcMain, type WebContents } from 'electron'
import { z } from 'zod'
import { IPC, type AppInfo } from '@shared/ipc'
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
  ui: () => WebContents | undefined
): void {
  const broadcast = (): void => ui()?.send(IPC.sitesChanged, store.list())

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
      broadcast()
    }
    return result
  })

  ipcMain.handle(IPC.sitesRemove, (_e, siteId: unknown) => {
    const parsed = id.parse(siteId)
    const removed = store.remove(parsed)
    if (removed) {
      manager()?.close(parsed)
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
  ipcMain.handle(IPC.viewOverlay, (_e, open: unknown) =>
    manager()?.setOverlay(z.boolean().parse(open))
  )
}
