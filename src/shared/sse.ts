/** The router reported a failure inside the stream (after the response started). */
export class StreamError extends Error {}

/**
 * Reads an OpenAI-style chat stream (server-sent events). Feed it chunks as they arrive; it
 * returns the text pieces they complete. Chunks can split a line anywhere.
 */
export class ChatStreamParser {
  private buffer = ''
  done = false

  push(chunk: string): string[] {
    this.buffer += chunk
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''
    const out: string[] = []
    for (const raw of lines) {
      const line = raw.trim()
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (data === '[DONE]') {
        this.done = true
        continue
      }
      let event: unknown
      try {
        event = JSON.parse(data)
      } catch {
        continue // a keep-alive or a vendor comment; not ours to fail on
      }
      const error = streamError(event)
      if (error) throw new StreamError(error)
      const piece = deltaText(event)
      if (piece) out.push(piece)
    }
    return out
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function deltaText(event: unknown): string | undefined {
  if (!isRecord(event) || !Array.isArray(event['choices'])) return undefined
  const choice: unknown = event['choices'][0]
  if (!isRecord(choice) || !isRecord(choice['delta'])) return undefined
  const content = choice['delta']['content']
  return typeof content === 'string' ? content : undefined
}

function streamError(event: unknown): string | undefined {
  if (!isRecord(event) || event['error'] === undefined) return undefined
  const error = event['error']
  if (isRecord(error) && typeof error['message'] === 'string') return error['message']
  return typeof error === 'string' ? error : 'The AI router reported an error.'
}
