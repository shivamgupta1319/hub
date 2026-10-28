import { z } from 'zod'

export const siteSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  url: z.url({ protocol: /^https?$/ }),
  iconDataUrl: z.string().startsWith('data:image/').optional(),
  keepAlive: z.boolean(),
  notifications: z.boolean(),
  createdAt: z.number()
})

export type Site = z.infer<typeof siteSchema>

export const sitesFileSchema = z.object({
  version: z.literal(1),
  sites: z.array(siteSchema)
})

export type SitesFile = z.infer<typeof sitesFileSchema>

export interface NewSite {
  name: string
  url: string
}

export type SitePatch = Partial<Pick<Site, 'name' | 'url' | 'keepAlive' | 'notifications'>>

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export const NAME_MAX = 60

/**
 * Turns what a person types ("gmail.com", "https://github.com/me") into a canonical http(s) URL.
 * Bare hosts get https://. Hosts need a dot unless they're localhost or an IP.
 */
export function normalizeUrl(input: string): Result<string> {
  const trimmed = input.trim()
  if (!trimmed) return { ok: false, error: 'Enter a web address, like mail.google.com.' }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  // "localhost:3000" looks like a scheme but isn't one.
  const looksLikeHostPort = /^[^/:]+:\d+/.test(trimmed)
  const candidate = hasScheme && !looksLikeHostPort ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return { ok: false, error: 'That doesn’t look like a web address.' }
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, error: 'Only http and https addresses can be added.' }
  }

  const host = url.hostname
  if (host !== 'localhost' && !isIpHost(host) && !/\.[a-z]{2,}$/i.test(host)) {
    return { ok: false, error: 'Add the full domain, like github.com.' }
  }

  return { ok: true, value: url.href }
}

/** A readable default name from a URL: "mail.google.com" → "Mail Google". */
export function defaultName(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, '')
  if (isIpHost(host)) return host
  const parts = host.split('.')
  const meaningful = parts.length > 2 ? parts.slice(0, -1) : parts.slice(0, 1)
  return meaningful
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
    .slice(0, NAME_MAX)
}

/** Hostname without "www.", for showing under a site's name. */
export function displayHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '')
}

function isIpHost(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')
}
