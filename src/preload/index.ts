import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type HubApi } from '@shared/ipc'

const api: HubApi = {
  appInfo: () => ipcRenderer.invoke(IPC.appInfo)
}

contextBridge.exposeInMainWorld('hub', api)
