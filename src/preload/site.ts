/// <reference lib="dom" />
// Runs in every site page (isolated world). It makes notification clicks bring Hub forward on
// the site, and hides passkey support (see below). It exposes nothing else.
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'

contextBridge.exposeInMainWorld('__hubFocusSite', () => ipcRenderer.send(IPC.siteFocusRequest))

contextBridge.executeInMainWorld({
  func: () => {
    // Electron has no passkey / security-key prompt on Linux, so a WebAuthn request never
    // finishes and sign-in pages (Microsoft, Google) spin forever. Hiding WebAuthn makes them
    // offer password, authenticator-app or code sign-in instead.
    delete (window as { PublicKeyCredential?: unknown }).PublicKeyCredential
    const credentials = navigator.credentials as CredentialsContainer | undefined
    if (credentials) {
      const refuse = (): Promise<never> =>
        Promise.reject(new DOMException('Passkeys aren’t supported in Hub.', 'NotAllowedError'))
      const get = credentials.get.bind(credentials)
      const create = credentials.create.bind(credentials)
      credentials.get = (options) => (options?.publicKey ? refuse() : get(options))
      credentials.create = (options) => (options?.publicKey ? refuse() : create(options))
    }

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
