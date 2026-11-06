import { app, ipcMain } from 'electron'
import { z } from 'zod'
import { IPC, type AiKeyStatus, type AppInfo } from '@shared/ipc'
import { settingsSchema, type Settings } from '@shared/settings'
import type { Result } from '@shared/site'
import { AiError, testConnection } from './ai'
import type { AiKeyStore } from './aiKey'
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

export function registerAiIpc(keys: AiKeyStore, settings: SettingsStore): void {
  const status = async (): Promise<AiKeyStatus> => ({
    saved: keys.has(),
    canStore: await keys.canStore()
  })
  ipcMain.handle(IPC.aiKeyStatus, status)

  ipcMain.handle(IPC.aiKeySet, async (_e, key: unknown): Promise<Result<AiKeyStatus>> => {
    const parsed = z.string().trim().min(1).max(500).nullable().parse(key)
    if (parsed === null) {
      keys.clear()
      return { ok: true, value: await status() }
    }
    if (!(await keys.canStore())) {
      return {
        ok: false,
        error: 'Hub needs your system keyring to store the key safely, and none is available.'
      }
    }
    await keys.set(parsed)
    return { ok: true, value: await status() }
  })

  ipcMain.handle(IPC.aiTest, async (): Promise<Result<true>> => {
    const key = await keys.get()
    if (!key) return { ok: false, error: 'Save a key first.' }
    const { aiBaseUrl, aiModel } = settings.get()
    try {
      await testConnection({ baseUrl: aiBaseUrl, model: aiModel, key })
      return { ok: true, value: true }
    } catch (err) {
      return { ok: false, error: err instanceof AiError ? err.message : 'The test failed.' }
    }
  })
}
