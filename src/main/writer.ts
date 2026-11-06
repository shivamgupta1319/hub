import { join } from 'node:path'
import {
  app,
  clipboard,
  ipcMain,
  WebContentsView,
  type BrowserWindow,
  type IpcMainEvent,
  type WebContents
} from 'electron'
import { z } from 'zod'
import { IPC, type WriterRun, type WriterState } from '@shared/ipc'
import { placePanel, SHEET_BELOW, type Rect } from '@shared/panel'
import {
  actionLabel,
  buildMessages,
  cleanResult,
  MAX_INPUT_CHARS,
  TONES,
  type ChatMessage,
  type WritingAction,
  type WritingContext
} from '@shared/writing'
import { AiError, streamChat, type AiConfig } from './ai'

const actionSchema: z.ZodType<WritingAction> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fix') }),
  z.object({ kind: z.literal('improve') }),
  z.object({ kind: z.literal('shorter') }),
  z.object({ kind: z.literal('longer') }),
  z.object({ kind: z.literal('tone'), tone: z.enum(TONES) }),
  z.object({ kind: z.literal('custom'), instruction: z.string().trim().min(1).max(1000) }),
  z.object({ kind: z.literal('draft'), instruction: z.string().trim().min(1).max(1000) })
])
const runSchema: z.ZodType<WriterRun> = z.union([
  z.object({ action: actionSchema }),
  z.object({ followUp: z.string().trim().min(1).max(1000) }),
  z.object({ retry: z.literal(true) })
])

/** Where the panel was opened from: the page, its selection, and where the click was. */
export interface WriterTarget {
  wc: WebContents
  text: string
  editable: boolean
  context: WritingContext
  /** Click position in window coordinates. */
  anchor: { x: number; y: number }
}

interface Deps {
  /** The router settings and key, or undefined when no key is saved. */
  config(): Promise<AiConfig | undefined>
  /** The part of the window the site pages use. */
  area(): Rect
  openSettings(): void
}

/**
 * The "Help me write" panel: a small page layered over the site, next to the text it works on.
 * The AI request runs here in main, so neither the site nor the panel ever sees the key.
 */
export class WritingPanel {
  private view: WebContentsView | undefined
  private loaded = false
  private target: WriterTarget | undefined
  private action: WritingAction | undefined
  private lastMessages: ChatMessage[] | undefined
  private request: AbortController | undefined
  private height = 180
  private state: WriterState = {
    mode: 'rewrite',
    phase: 'ask',
    label: '',
    result: '',
    needsSettings: false,
    canApply: false,
    sheet: false
  }

  constructor(
    private readonly win: BrowserWindow,
    private readonly deps: Deps
  ) {
    const fromPanel = (event: IpcMainEvent): boolean =>
      Boolean(this.view && event.sender === this.view.webContents)
    ipcMain.on(IPC.writerRun, (event, request: unknown) => {
      if (fromPanel(event)) this.run(runSchema.parse(request))
    })
    ipcMain.on(IPC.writerApply, (event) => {
      if (fromPanel(event)) void this.apply()
    })
    ipcMain.on(IPC.writerCopy, (event) => {
      if (fromPanel(event)) clipboard.writeText(this.state.result)
    })
    ipcMain.on(IPC.writerStop, (event) => {
      if (fromPanel(event)) this.stop()
    })
    ipcMain.on(IPC.writerClose, (event) => {
      if (fromPanel(event)) this.close()
    })
    ipcMain.on(IPC.writerSettings, (event) => {
      if (!fromPanel(event)) return
      this.close()
      deps.openSettings()
    })
    ipcMain.on(IPC.writerResize, (event, height: unknown) => {
      if (!fromPanel(event)) return
      this.height = z.number().min(40).max(4000).parse(height)
      this.layout()
    })
    win.on('resize', () => this.layout())
  }

  get isOpen(): boolean {
    return this.target !== undefined
  }

  /**
   * Opens the panel. With an action it starts right away; without one it asks for an
   * instruction first ("Custom…" on a selection, or drafting into an empty box).
   */
  open(target: WriterTarget, action: WritingAction | null): void {
    this.stop()
    this.target = target
    this.action = undefined
    const mode = target.text ? 'rewrite' : 'draft'
    this.state = {
      mode,
      phase: 'ask',
      label: mode === 'draft' ? 'Help me write' : 'Rewrite',
      result: '',
      needsSettings: false,
      canApply: target.editable,
      sheet: this.deps.area().width < SHEET_BELOW
    }
    this.show()
    if (target.text.length > MAX_INPUT_CHARS) {
      this.update({
        phase: 'error',
        label: 'Help me write',
        error: `That’s a lot of text. Select up to ${MAX_INPUT_CHARS.toLocaleString('en')} characters and try again.`
      })
    } else if (action) {
      this.run({ action })
    } else {
      this.publish()
    }
  }

  close(): void {
    this.stop()
    this.target = undefined
    this.view?.setVisible(false)
  }

  private run(request: WriterRun): void {
    const target = this.target
    if (!target) return
    let messages: ChatMessage[]
    if ('action' in request) {
      this.action = request.action
      messages = buildMessages(request.action, target.text, target.context)
    } else if ('followUp' in request) {
      if (!this.action || !this.state.result) return
      messages = buildMessages(this.action, target.text, target.context, {
        previous: this.state.result,
        instruction: request.followUp
      })
    } else {
      if (!this.lastMessages) return
      messages = this.lastMessages
    }
    this.lastMessages = messages
    void this.stream(messages, this.action ? actionLabel(this.action) : this.state.label)
  }

  private async stream(messages: ChatMessage[], label: string): Promise<void> {
    this.stop()
    const request = new AbortController()
    this.request = request
    this.update({ phase: 'working', label, result: '', needsSettings: false })
    const config = await this.deps.config()
    if (this.request !== request) return
    if (!config) {
      this.request = undefined
      this.update({
        phase: 'error',
        label,
        error: 'Add your AI router key in Settings to use writing help.',
        needsSettings: true
      })
      return
    }
    try {
      const text = await streamChat(
        config,
        messages,
        (soFar) => {
          if (this.request === request) this.update({ result: soFar })
        },
        request.signal
      )
      if (this.request === request) this.update({ phase: 'done', result: cleanResult(text) })
    } catch (err) {
      if (this.request !== request) return
      const aiError =
        err instanceof AiError ? err : new AiError('Something went wrong. Try again.', 'busy')
      if (aiError.kind === 'aborted') {
        this.update({ phase: this.state.result ? 'done' : 'ask' })
      } else {
        this.update({
          phase: 'error',
          error: aiError.message,
          needsSettings: aiError.kind === 'auth'
        })
      }
    } finally {
      if (this.request === request) this.request = undefined
    }
  }

  private stop(): void {
    const request = this.request
    this.request = undefined
    request?.abort()
    if (request && this.state.phase === 'working') {
      this.update({ phase: this.state.result ? 'done' : 'ask' })
    }
  }

  /** Puts the answer back into the page, replacing the selection (or at the caret). */
  private async apply(): Promise<void> {
    const target = this.target
    const text = this.state.result
    if (!target || !text || !target.editable || target.wc.isDestroyed()) return
    this.close()
    target.wc.focus()
    await target.wc.insertText(text)
  }

  private update(patch: Partial<WriterState>): void {
    this.state = { ...this.state, ...patch }
    this.publish()
  }

  private publish(): void {
    if (this.view && this.loaded) this.view.webContents.send(IPC.writerState, this.state)
  }

  private show(): void {
    const view = this.view ?? this.createView()
    // Adding an existing child moves it to the top, above whichever site page is showing.
    this.win.contentView.addChildView(view)
    this.layout()
    view.setVisible(true)
    if (this.loaded) view.webContents.focus()
  }

  private layout(): void {
    if (!this.view || !this.target) return
    const area = this.deps.area()
    const sheet = area.width < SHEET_BELOW
    if (sheet !== this.state.sheet) this.update({ sheet })
    this.view.setBounds(placePanel(this.target.anchor, this.height, area))
  }

  private createView(): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, '../preload/writer.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: true
      }
    })
    view.setBackgroundColor('#00000000')
    view.setBorderRadius(12)
    view.setVisible(false)
    this.view = view
    const wc = view.webContents
    // The panel page has no links of its own; never let it navigate or open windows.
    wc.setWindowOpenHandler(() => ({ action: 'deny' }))
    wc.on('will-navigate', (event) => event.preventDefault())
    wc.on('did-finish-load', () => {
      this.loaded = true
      this.publish()
      if (this.target) wc.focus()
    })
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!app.isPackaged && devUrl) void wc.loadURL(`${devUrl}/writer.html`)
    else void wc.loadFile(join(__dirname, '../renderer/writer.html'))
    return view
  }
}
