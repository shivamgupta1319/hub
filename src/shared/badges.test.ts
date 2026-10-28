import { describe, expect, it } from 'vitest'
import { badgeLabel, parseBadge, totalUnread } from './badges'

describe('parseBadge', () => {
  it.each([
    ['(3) WhatsApp', 3],
    ['[12] Feed | LinkedIn', 12],
    ['(1,204) Twitter', 1204],
    ['(99+) Notifications', 99],
    ['Inbox (5) - me@gmail.com - Gmail', 5],
    ['* Slack | general | Acme', 'dot'],
    ['• Google Chat', 'dot'],
    ['WhatsApp', null],
    ['Inbox - me@gmail.com - Gmail', null],
    ['(0) WhatsApp', null],
    ['Pull requests · anthropics/claude', null],
    ['', null]
  ] as const)('%j → %j', (title, expected) => {
    expect(parseBadge(title)).toBe(expected)
  })
})

describe('totalUnread', () => {
  it('adds counts and ignores dots', () => {
    expect(totalUnread([3, 'dot', null, 12])).toBe(15)
  })
})

describe('badgeLabel', () => {
  it('caps at 99+', () => {
    expect(badgeLabel(7)).toBe('7')
    expect(badgeLabel(120)).toBe('99+')
  })
})
