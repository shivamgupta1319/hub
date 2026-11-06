import type { ChatMessage } from '@shared/writing'
import { ChatStreamParser, StreamError } from '@shared/sse'

export interface AiConfig {
  /** OpenAI-compatible base URL, e.g. https://ai.pseo.cloud/v1 */
  baseUrl: string
  model: string
  key: string
}

export type AiErrorKind = 'auth' | 'busy' | 'network' | 'bad-request' | 'aborted'

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: AiErrorKind
  ) {
    super(message)
  }
}

// The router's own budget across all its fallbacks; Hub waits a little longer than that.
const ROUTER_BUDGET_MS = 30_000
const TIMEOUT_MS = 40_000

/** Turns an HTTP failure from the router into a message for the writing panel. */
export function errorForStatus(status: number, body: string): AiError {
  if (status === 401 || status === 403) {
    return new AiError('The AI router didn’t accept Hub’s key. Check it in Settings.', 'auth')
  }
  if (status === 429 || status >= 500) {
    return new AiError('No AI model answered in time. Try again in a moment.', 'busy')
  }
  const detail = /"message"\s*:\s*"([^"]{1,200})"/.exec(body)?.[1]
  return new AiError(
    detail ? `The AI router refused: ${detail}` : `The AI router refused (${status}).`,
    'bad-request'
  )
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}

async function post(
  config: AiConfig,
  body: Record<string, unknown>,
  signal: AbortSignal
): Promise<Response> {
  try {
    const res = await fetch(endpoint(config.baseUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${config.key}` },
      body: JSON.stringify({
        model: config.model,
        ...body,
        ai_router: { budget_ms: ROUTER_BUDGET_MS }
      }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)])
    })
    if (!res.ok) throw errorForStatus(res.status, await res.text().catch(() => ''))
    return res
  } catch (err) {
    throw toAiError(err, signal)
  }
}

function toAiError(err: unknown, signal: AbortSignal): AiError {
  if (err instanceof AiError) return err
  if (signal.aborted) return new AiError('Stopped.', 'aborted')
  if (err instanceof Error && err.name === 'TimeoutError') {
    return new AiError('No AI model answered in time. Try again in a moment.', 'busy')
  }
  return new AiError('Hub couldn’t reach the AI router. Check your connection.', 'network')
}

/** Streams a chat completion, calling `onText` with the text so far. Resolves with the full text. */
export async function streamChat(
  config: AiConfig,
  messages: ChatMessage[],
  onText: (soFar: string) => void,
  signal: AbortSignal
): Promise<string> {
  const res = await post(config, { messages, stream: true, temperature: 0.4 }, signal)
  if (!res.body) throw new AiError('The AI router sent an empty answer.', 'busy')
  const parser = new ChatStreamParser()
  const decoder = new TextDecoder()
  let text = ''
  try {
    for await (const chunk of res.body) {
      for (const piece of parser.push(decoder.decode(chunk, { stream: true }))) {
        text += piece
        onText(text)
      }
      if (parser.done) break
    }
  } catch (err) {
    if (err instanceof StreamError) throw new AiError(err.message, 'busy')
    throw toAiError(err, signal)
  }
  if (!text.trim()) throw new AiError('The AI model sent back an empty answer. Try again.', 'busy')
  return text
}

/** One tiny request, so Settings can say whether the address, key and model work. */
export async function testConnection(config: AiConfig): Promise<void> {
  const res = await post(
    config,
    { messages: [{ role: 'user', content: 'Reply with: OK' }], max_tokens: 5 },
    new AbortController().signal
  )
  await res.text()
}
