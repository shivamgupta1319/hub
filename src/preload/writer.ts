// The writing panel's bridge. It only talks to main; the key and the AI requests stay there.
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC, type WriterApi, type WriterState } from '@shared/ipc'

const api: WriterApi = {
  onState: (listener) => {
    const handler = (_e: IpcRendererEvent, state: WriterState): void => listener(state)
    ipcRenderer.on(IPC.writerState, handler)
    return () => ipcRenderer.off(IPC.writerState, handler)
  },
  run: (request) => ipcRenderer.send(IPC.writerRun, request),
  apply: () => ipcRenderer.send(IPC.writerApply),
  copy: () => ipcRenderer.send(IPC.writerCopy),
  stop: () => ipcRenderer.send(IPC.writerStop),
  close: () => ipcRenderer.send(IPC.writerClose),
  openSettings: () => ipcRenderer.send(IPC.writerSettings),
  resize: (height) => ipcRenderer.send(IPC.writerResize, height)
}

contextBridge.exposeInMainWorld('writer', api)
