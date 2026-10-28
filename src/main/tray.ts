import { Menu, Tray, type MenuItemConstructorOptions } from 'electron'
import { badgeLabel, type Badge } from '@shared/badges'
import type { Site } from '@shared/site'

interface TrayActions {
  show: () => void
  open: (id: string) => void
  quit: () => void
}

/**
 * Hub's icon in the top bar (Ubuntu shows it through AppIndicator, which only supports a menu,
 * not clicks). Lists sites with their unread counts so they can be opened directly.
 */
export class HubTray {
  private readonly tray: Tray

  constructor(
    iconPath: string,
    private readonly actions: TrayActions
  ) {
    this.tray = new Tray(iconPath)
    this.tray.on('click', actions.show) // works where the desktop supports tray clicks
    this.update([], () => null)
  }

  update(sites: readonly Site[], badgeFor: (id: string) => Badge): void {
    let total = 0
    const siteItems: MenuItemConstructorOptions[] = sites.map((site) => {
      const badge = badgeFor(site.id)
      if (typeof badge === 'number') total += badge
      const suffix = typeof badge === 'number' ? ` (${badgeLabel(badge)})` : badge ? ' •' : ''
      return { label: `${site.name}${suffix}`, click: () => this.actions.open(site.id) }
    })
    this.tray.setToolTip(total > 0 ? `Hub — ${total} unread` : 'Hub')
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open Hub', click: this.actions.show },
        ...(siteItems.length ? [{ type: 'separator' } as const, ...siteItems] : []),
        { type: 'separator' },
        { label: 'Quit Hub', click: this.actions.quit }
      ])
    )
  }

  destroy(): void {
    this.tray.destroy()
  }
}
