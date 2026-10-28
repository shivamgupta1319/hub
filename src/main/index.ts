import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme, shell } from 'electron'
import { IPC } from '@shared/ipc'
import icon from '../../resources/icon.png?asset'
import { cleanUserAgent } from '@shared/links'
import { broadcastSites, registerIpc } from './ipc'
import { SiteManager } from './siteManager'
import { SiteStore } from './store'

// Matches --bg in the renderer so the window doesn't flash white on open.
const BG_LIGHT = '#f3f5f7'
const BG_DARK = '#16191d'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 480,
    show: false,
    title: 'Hub',
    icon,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? BG_DARK : BG_LIGHT,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win.show())

  // The UI never opens windows itself; anything it links to goes to the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (!app.isPackaged && devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))

  return win
}

// Lets tests and screenshot runs use a throwaway profile.
const userDataOverride = process.env['HUB_USER_DATA']
if (userDataOverride) app.setPath('userData', userDataOverride)

let mainWindow: BrowserWindow | undefined
let manager: SiteManager | undefined

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  void app.whenReady().then(() => {
    const store = new SiteStore(join(app.getPath('userData'), 'sites.json'))
    app.userAgentFallback = cleanUserAgent(app.userAgentFallback)
    registerIpc(
      store,
      () => manager,
      () => mainWindow?.webContents
    )
    mainWindow = createWindow()
    const ui = mainWindow.webContents
    manager = new SiteManager(mainWindow, store, {
      active: (id) => ui.send(IPC.viewActive, id),
      status: (status) => ui.send(IPC.viewStatus, status),
      sitesChanged: () => broadcastSites(store, ui),
      command: (id, command) => ui.send(IPC.siteCommand, id, command)
    })
    // Lets the smoke test use a short sleep delay instead of the default 30 minutes.
    const sleepOverride = Number(process.env['HUB_SLEEP_AFTER_MS'])
    if (sleepOverride > 0) manager.setSleepAfter(sleepOverride)
    ui.once('did-finish-load', () => manager?.startBackground())
  })

  app.on('window-all-closed', () => app.quit())
}
