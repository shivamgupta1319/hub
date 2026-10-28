import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type HubApi } from '@shared/ipc'
import type { Site } from '@shared/site'

const api: HubApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  sites: {
    list: () => ipcRenderer.invoke(IPC.sitesList),
    add: (input) => ipcRenderer.invoke(IPC.sitesAdd, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.sitesUpdate, id, patch),
    remove: (id) => ipcRenderer.invoke(IPC.sitesRemove, id),
    reorder: (ids) => ipcRenderer.invoke(IPC.sitesReorder, ids),
    onChanged: (listener) => {
      const handler = (_e: IpcRendererEvent, sites: Site[]): void => listener(sites)
      ipcRenderer.on(IPC.sitesChanged, handler)
      return () => ipcRenderer.off(IPC.sitesChanged, handler)
    }
  }
}

contextBridge.exposeInMainWorld('hub', api)
