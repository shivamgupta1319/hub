/** Unread indicator read from a page title: a count, a plain dot, or nothing. */
export type Badge = number | 'dot' | null

const LEADING_COUNT = /^\s*[([]\s*(\d[\d,.]*)\+?\s*[)\]]/ // "(3) WhatsApp", "[12] Feed"
const INBOX_COUNT = /\bInbox\s*\((\d[\d,.]*)\)/i // "Inbox (5) - me@gmail.com - Gmail"
const LEADING_MARK = /^\s*[•●*!]\s/ // "* Slack", "• Chat"

export function parseBadge(title: string): Badge {
  const match = LEADING_COUNT.exec(title) ?? INBOX_COUNT.exec(title)
  if (match?.[1]) {
    const count = Number(match[1].replace(/[,.]/g, ''))
    if (count > 0) return count
  }
  return LEADING_MARK.test(title) ? 'dot' : null
}

/** Sum of counted badges, for the tray and launcher. Dots don't add to the number. */
export function totalUnread(badges: Iterable<Badge>): number {
  let total = 0
  for (const b of badges) if (typeof b === 'number') total += b
  return total
}

/** Short text for a badge pill. */
export function badgeLabel(badge: number): string {
  return badge > 99 ? '99+' : String(badge)
}
