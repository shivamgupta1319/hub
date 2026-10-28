import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { totalUnread } from '@shared/badges'
import { IPC } from '@shared/ipc'
import { cleanUserAgent } from '@shared/links'
import type { Settings } from '@shared/settings'
import icon from '../../resources/icon.png?asset'
import iconSvg from '../../resources/icon.svg?asset'
import trayIcon from '../../resources/tray.png?asset'
import { buildAppMenu } from './appMenu'
import { HIDDEN_FLAG, setLaunchAtLogin } from './autostart'
import { syncLauncherEntry } from './desktopIntegration'
import { registerIpc, registerSettingsIpc } from './ipc'
import { SettingsStore } from './settings'
import { SiteManager } from './siteManager'
import { SiteStore } from './store'
import { HubTray } from './tray'

// Matches --bg in the renderer so the window doesn't flash white on open.
const BG_LIGHT = '#f3f5f7'
const BG_DARK = '#16191d'

function createWindow(showWhenReady: boolean): BrowserWindow {
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

  if (showWhenReady) win.once('ready-to-show', () => win.show())

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

/** How to start this exact build again: the AppImage, the installed binary, or dev Electron. */
function launchCommand(): string[] {
  const appImage = process.env['APPIMAGE']
  if (appImage) return [appImage]
  return app.isPackaged ? [process.execPath] : [process.execPath, app.getAppPath()]
}

// Lets tests and screenshot runs use a throwaway profile.
const userDataOverride = process.env['HUB_USER_DATA']
if (userDataOverride) app.setPath('userData', userDataOverride)

let mainWindow: BrowserWindow | undefined
let manager: SiteManager | undefined
let tray: HubTray | undefined
let quitting = false

function showWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // Launching Hub again (from the app grid, or while hidden in the tray) shows the window.
  app.on('second-instance', showWindow)
  app.on('before-quit', () => {
    quitting = true
  })

  void app.whenReady().then(() => {
    const userData = app.getPath('userData')
    const store = new SiteStore(join(userData, 'sites.json'))
    const settings = new SettingsStore(join(userData, 'settings.json'))
    app.userAgentFallback = cleanUserAgent(app.userAgentFallback)

    // Gives the dock its Hub icon. The .deb ships its own launcher entry, so only the AppImage
    // and dev runs install one; under the .deb, Hub's own copy is removed so the system one wins.
    try {
      const fromDeb = app.isPackaged && !process.env['APPIMAGE']
      syncLauncherEntry(fromDeb ? null : launchCommand(), [
        { file: icon, size: '256x256', ext: 'png' },
        { file: iconSvg, size: 'scalable', ext: 'svg' }
      ])
    } catch (err) {
      console.error('could not install the launcher entry', err)
    }

    // Started at login: wait in the tray until the person opens Hub.
    const startHidden = process.argv.includes(HIDDEN_FLAG)
    mainWindow = createWindow(!startHidden)
    const win = mainWindow
    const ui = win.webContents

    tray = new HubTray(trayIcon, {
      show: showWindow,
      open: (id) => {
        showWindow()
        manager?.open(id)
      },
      quit: () => app.quit()
    })
    const updateTray = (): void => tray?.update(store.list(), (id) => manager?.badgeFor(id) ?? null)

    // Every change to the saved sites updates the UI, the shortcut menu (Ctrl+1…9) and the tray.
    const sitesChanged = (): void => {
      ui.send(IPC.sitesChanged, store.list())
      if (manager) buildAppMenu(store.list(), manager, (command) => ui.send(IPC.uiCommand, command))
      updateTray()
    }
    registerIpc(store, () => manager, sitesChanged)

    manager = new SiteManager(win, store, {
      active: (id) => ui.send(IPC.viewActive, id),
      status: (status) => ui.send(IPC.viewStatus, status),
      sitesChanged,
      command: (id, command) => ui.send(IPC.siteCommand, id, command),
      badge: (id, badge) => {
        ui.send(IPC.viewBadge, id, badge)
        // Shows the total on the Ubuntu dock icon where the launcher supports it.
        app.setBadgeCount(totalUnread(manager?.allBadges() ?? []))
        updateTray()
      }
    })

    const applySettings = (value: Settings): void => {
      manager?.setSleepAfter(value.sleepAfterMinutes * 60_000)
      // Rewritten every start so the entry follows the AppImage if it was moved.
      setLaunchAtLogin(value.launchAtLogin, launchCommand())
    }
    registerSettingsIpc(settings, applySettings)
    applySettings(settings.get())
    // Lets the smoke test use a short sleep delay instead of minutes.
    const sleepOverride = Number(process.env['HUB_SLEEP_AFTER_MS'])
    if (sleepOverride > 0) manager.setSleepAfter(sleepOverride)

    // Closing the window keeps Hub running in the tray, so chat notifications keep arriving.
    win.on('close', (event) => {
      if (quitting || !settings.get().closeToTray || !tray) return
      event.preventDefault()
      win.hide()
    })

    // A site's notification was clicked: bring Hub forward on that site.
    ipcMain.on(IPC.siteFocusRequest, (event) => {
      const id = manager?.siteIdFor(event.sender)
      if (!id) return
      showWindow()
      manager?.open(id)
    })

    sitesChanged()
    ui.once('did-finish-load', () => manager?.startBackground())
  })

  app.on('window-all-closed', () => app.quit())
}
