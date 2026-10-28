/** What to do when a site tries to open a new window. */
export type PopupDecision = 'in-app' | 'external' | 'block'

// Sign-in pages that must open inside Hub so the login lands in the site's own session.
const AUTH_PAGES: readonly { host: string; path?: string }[] = [
  { host: 'accounts.google.com' },
  { host: 'login.microsoftonline.com' },
  { host: 'login.live.com' },
  { host: 'appleid.apple.com' },
  { host: 'github.com', path: '/login' },
  { host: 'slack.com', path: '/oauth' }
]

const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Popups stay in Hub only for the site's own host (e.g. Gmail's pop-out compose) and sign-in
 * pages. Everything else, like links inside an email, goes to the default browser.
 */
export function popupDecision(target: string, siteUrl: string): PopupDecision {
  if (target === '' || target === 'about:blank') return 'in-app'

  let url: URL
  try {
    url = new URL(target)
  } catch {
    return 'block'
  }
  if (!EXTERNAL_SCHEMES.has(url.protocol)) return 'block'
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'external'

  const isAuth = AUTH_PAGES.some(
    (p) => url.hostname === p.host && (!p.path || url.pathname.startsWith(p.path))
  )
  if (isAuth || url.hostname === new URL(siteUrl).hostname) return 'in-app'
  return 'external'
}

/** Drops the Electron and app tokens so sites (notably Google sign-in) see a normal Chrome. */
export function cleanUserAgent(ua: string): string {
  return ua
    .replace(/\sElectron\/\S+/i, '')
    .replace(/\shub\/\S+/i, '')
    .replace(/\s{2,}/g, ' ')
}
