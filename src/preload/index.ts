import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type HubApi, type SiteCommand, type ViewStatus } from '@shared/ipc'
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
  },
  view: {
    open: (id) => ipcRenderer.invoke(IPC.viewOpen, id),
    home: () => ipcRenderer.invoke(IPC.viewHome),
    reload: (id) => ipcRenderer.invoke(IPC.viewReload, id),
    setOverlay: (open) => ipcRenderer.invoke(IPC.viewOverlay, open),
    onActive: (listener) => {
      const handler = (_e: IpcRendererEvent, id: string | null): void => listener(id)
      ipcRenderer.on(IPC.viewActive, handler)
      return () => ipcRenderer.off(IPC.viewActive, handler)
    },
    onStatus: (listener) => {
      const handler = (_e: IpcRendererEvent, status: ViewStatus): void => listener(status)
      ipcRenderer.on(IPC.viewStatus, handler)
      return () => ipcRenderer.off(IPC.viewStatus, handler)
    },
    showSiteMenu: (id) => ipcRenderer.invoke(IPC.siteMenu, id),
    onSiteCommand: (listener) => {
      const handler = (_e: IpcRendererEvent, id: string, command: SiteCommand): void =>
        listener(id, command)
      ipcRenderer.on(IPC.siteCommand, handler)
      return () => ipcRenderer.off(IPC.siteCommand, handler)
    }
  }
}

contextBridge.exposeInMainWorld('hub', api)
