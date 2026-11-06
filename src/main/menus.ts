import {
  clipboard,
  Menu,
  shell,
  type BrowserWindow,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents
} from 'electron'
import type { SiteCommand } from '@shared/ipc'
import { toneLabel, TONES, type WritingAction } from '@shared/writing'

/** How the page menu reaches "Help me write". */
export interface WritingMenu {
  /** `off` hides it; `setup` shows an entry that opens Settings to add a key. */
  status(): 'ready' | 'setup' | 'off'
  /** `null` asks for an instruction first. */
  open(wc: WebContents, params: ContextMenuParams, action: WritingAction | null): void
  setup(): void
}

function writingItems(
  writing: WritingMenu,
  wc: WebContents,
  params: ContextMenuParams
): MenuItemConstructorOptions[] {
  const hasText = params.selectionText.trim() !== ''
  if (!hasText && !params.isEditable) return []
  const status = writing.status()
  if (status === 'off') return []
  if (status === 'setup') {
    return [
      { label: 'Help me write (set up)…', click: () => writing.setup() },
      { type: 'separator' }
    ]
  }
  const run = (action: WritingAction | null) => () => writing.open(wc, params, action)
  if (!hasText) return [{ label: 'Help me write…', click: run(null) }, { type: 'separator' }]
  return [
    {
      label: 'Help me write',
      submenu: [
        { label: 'Fix spelling && grammar', click: run({ kind: 'fix' }) },
        { label: 'Improve writing', click: run({ kind: 'improve' }) },
        { label: 'Make shorter', click: run({ kind: 'shorter' }) },
        { label: 'Make longer', click: run({ kind: 'longer' }) },
        {
          label: 'Change tone',
          submenu: TONES.map((tone) => ({
            label: toneLabel(tone),
            click: run({ kind: 'tone', tone })
          }))
        },
        { type: 'separator' },
        { label: 'Custom…', click: run(null) }
      ]
    },
    { type: 'separator' }
  ]
}

/** Right-click menu inside a site's page: writing help, links, editing, spelling, navigation. */
export function attachPageMenu(wc: WebContents, win: BrowserWindow, writing?: WritingMenu): void {
  wc.on('context-menu', (_e, params) => {
    const items: MenuItemConstructorOptions[] = writing ? writingItems(writing, wc, params) : []

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
