import { app, Menu, type MenuItemConstructorOptions } from 'electron'
import type { UiCommand } from '@shared/ipc'
import type { Site } from '@shared/site'
import type { SiteManager } from './siteManager'

/**
 * The window menu holds every keyboard shortcut. It opens from the title bar's ☰ button or a tap
 * on Alt, which also makes the shortcuts discoverable. Rebuilt when sites change so Ctrl+1…9 follow the order.
 */
export function buildAppMenu(
  sites: readonly Site[],
  manager: SiteManager,
  sendUi: (command: UiCommand) => void
): void {
  const goTo: MenuItemConstructorOptions[] = sites.slice(0, 9).map((site, i) => ({
    label: site.name,
    accelerator: `CmdOrCtrl+${i + 1}`,
    click: () => manager.open(site.id)
  }))

  const template: MenuItemConstructorOptions[] = [
    {
      label: '&Hub',
      submenu: [
        {
          label: 'Add site…',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendUi('add-site')
        },
        {
          label: 'Go to site…',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => sendUi('quick-switch')
        },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => sendUi('settings') },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() }
      ]
    },
    { label: '&Edit', role: 'editMenu' },
    {
      label: '&View',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => manager.reloadActive(false) },
        {
          label: 'Reload without cache',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => manager.reloadActive(true)
        },
        { type: 'separator' },
        // SiteManager handles the zoom keys itself, so =, + and the number pad all work.
        { label: 'Zoom in', accelerator: 'CmdOrCtrl+Plus', click: () => manager.zoom(1) },
        { label: 'Zoom out', accelerator: 'CmdOrCtrl+-', click: () => manager.zoom(-1) },
        { label: 'Actual size', accelerator: 'CmdOrCtrl+0', click: () => manager.zoom(0) },
        { type: 'separator' },
        { label: 'Full screen', role: 'togglefullscreen' },
        {
          label: 'Developer tools for this site',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => manager.toggleDevTools()
        }
      ]
    },
    {
      label: '&Go',
      submenu: [
        { label: 'All sites', accelerator: 'Alt+Home', click: () => manager.home() },
        { label: 'Back', accelerator: 'Alt+Left', click: () => manager.history(-1) },
        { label: 'Forward', accelerator: 'Alt+Right', click: () => manager.history(1) },
        { type: 'separator' },
        { label: 'Next site', accelerator: 'Ctrl+Tab', click: () => manager.cycle(1) },
        { label: 'Previous site', accelerator: 'Ctrl+Shift+Tab', click: () => manager.cycle(-1) },
        ...(goTo.length ? [{ type: 'separator' } as const, ...goTo] : [])
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
