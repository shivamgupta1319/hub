import { describe, expect, it } from 'vitest'
import { cleanUserAgent, popupDecision } from './links'

const gmail = 'https://mail.google.com/mail/u/0/'

describe('popupDecision', () => {
  it.each([
    ['https://mail.google.com/mail/u/0/?view=cm', 'in-app'],
    ['https://accounts.google.com/o/oauth2/auth', 'in-app'],
    ['https://github.com/login/oauth/authorize?x=1', 'in-app'],
    ['about:blank', 'in-app'],
    ['', 'in-app'],
    ['https://www.google.com/url?q=https://example.com', 'external'],
    ['https://github.com/anthropics', 'external'],
    ['https://meet.google.com/abc-defg-hij', 'external'],
    ['mailto:someone@example.com', 'external'],
    ['file:///etc/passwd', 'block'],
    ['javascript:alert(1)', 'block'],
    ['zoommtg://zoom.us/join', 'block'],
    ['not a url', 'block']
  ] as const)('%s → %s', (target, expected) => {
    expect(popupDecision(target, gmail)).toBe(expected)
  })
})

describe('cleanUserAgent', () => {
  it('removes Electron and app tokens', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) hub/0.1.0 Chrome/142.0.0.0 Electron/45.1.0 Safari/537.36'
    expect(cleanUserAgent(ua)).toBe(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
    )
  })
})
