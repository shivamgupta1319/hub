import type { Session } from 'electron'

const MAX_BYTES = 256 * 1024

/**
 * Downloads a favicon through the site's own session (so cookie-gated icons work) and returns
 * it as a data URL, or undefined when it isn't a reasonably sized image.
 */
export async function fetchIcon(ses: Session, url: string): Promise<string | undefined> {
  try {
    const res = await ses.fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return undefined
    const type = (res.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? ''
    if (!type.startsWith('image/')) return undefined
    const bytes = Buffer.from(await res.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return undefined
    return `data:${type};base64,${bytes.toString('base64')}`
  } catch {
    return undefined
  }
}
