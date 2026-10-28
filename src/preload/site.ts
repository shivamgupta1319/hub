/// <reference lib="dom" />
// Runs in every site page (isolated world). Its only job: when the person clicks one of the
// site's notifications, ask Hub to come forward on that site. It exposes nothing else.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

contextBridge.exposeInMainWorld('__hubFocusSite', () => ipcRenderer.send(IPC.siteFocusRequest))

contextBridge.executeInMainWorld({
  func: () => {
    const Native = window.Notification
    if (!Native) return
    const focus = (window as unknown as { __hubFocusSite?: () => void }).__hubFocusSite
    // Subclassing keeps Notification.permission / requestPermission working for the site.
    class HubNotification extends Native {
      constructor(title: string, options?: NotificationOptions) {
        super(title, options)
        this.addEventListener('click', () => focus?.())
      }
    }
    window.Notification = HubNotification
  }
})
