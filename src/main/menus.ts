import {
  clipboard,
  Menu,
  shell,
  type BrowserWindow,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'
import type { SiteCommand } from '@shared/ipc'

/** Right-click menu inside a site's page: links, editing, spelling and navigation. */
export function attachPageMenu(wc: WebContents, win: BrowserWindow): void {
  wc.on('context-menu', (_e, params) => {
    const items: MenuItemConstructorOptions[] = []

    if (params.misspelledWord) {
      for (const word of params.dictionarySuggestions.slice(0, 4)) {
        items.push({ label: word, click: () => wc.replaceMisspelling(word) })
      }
      items.push(
        {
          label: 'Add to dictionary',
          click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord)
        },
        { type: 'separator' }
      )
    }

    if (params.linkURL) {
      items.push(
        { label: 'Open link in browser', click: () => void shell.openExternal(params.linkURL) },
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' }
      )
    }

    if (params.isEditable) {
      items.push(
        { role: 'cut', enabled: params.editFlags.canCut },
        { role: 'copy', enabled: params.editFlags.canCopy },
        { role: 'paste', enabled: params.editFlags.canPaste },
        { role: 'selectAll' },
        { type: 'separator' }
      )
    } else if (params.selectionText) {
      items.push({ role: 'copy' }, { type: 'separator' })
    }

    const nav = wc.navigationHistory
    items.push(
      { label: 'Back', enabled: nav.canGoBack(), click: () => nav.goBack() },
      { label: 'Forward', enabled: nav.canGoForward(), click: () => nav.goForward() },
      { label: 'Reload', click: () => wc.reload() }
    )

    Menu.buildFromTemplate(items).popup({ window: win })
  })
}

/** Right-click menu on a sidebar icon. Edit and remove are handled by the UI's dialogs. */
export function showSiteMenu(
  win: BrowserWindow,
  options: {
    canMoveUp: boolean
    canMoveDown: boolean
    onMove: (step: -1 | 1) => void
    canSleep: boolean
    onSleep: () => void
    pageUrl: string | undefined
    onReload: () => void
    onCommand: (command: SiteCommand) => void
  }
): void {
  const { pageUrl } = options
  Menu.buildFromTemplate([
    { label: 'Reload', click: options.onReload },
    { label: 'Sleep now', enabled: options.canSleep, click: options.onSleep },
    {
      label: 'Open in browser',
      enabled: Boolean(pageUrl),
      click: () => pageUrl && void shell.openExternal(pageUrl)
    },
    { type: 'separator' },
    { label: 'Move up', enabled: options.canMoveUp, click: () => options.onMove(-1) },
    { label: 'Move down', enabled: options.canMoveDown, click: () => options.onMove(1) },
    { type: 'separator' },
    { label: 'Edit…', click: () => options.onCommand('edit') },
    { label: 'Remove…', click: () => options.onCommand('remove') }
  ]).popup({ window: win })
}
