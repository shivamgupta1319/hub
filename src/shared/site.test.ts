import { describe, expect, it } from 'vitest'
import { defaultName, normalizeUrl } from './site'

describe('normalizeUrl', () => {
  it.each([
    ['gmail.com', 'https://gmail.com/'],
    ['  mail.google.com  ', 'https://mail.google.com/'],
    ['https://github.com/me', 'https://github.com/me'],
    ['http://intranet.example.org', 'http://intranet.example.org/'],
    ['localhost:3000', 'https://localhost:3000/'],
    ['http://localhost:5173/app', 'http://localhost:5173/app'],
    ['192.168.1.10', 'https://192.168.1.10/']
  ])('accepts %s', (input, expected) => {
    expect(normalizeUrl(input)).toEqual({ ok: true, value: expected })
  })

  it.each([
    '',
    '   ',
    'gmail',
    'ftp://files.example.com',
    'javascript:alert(1)',
    'file:///etc/passwd'
  ])('rejects %j', (input) => {
    expect(normalizeUrl(input).ok).toBe(false)
  })
})

describe('defaultName', () => {
  it.each([
    ['https://mail.google.com/', 'Mail Google'],
    ['https://www.github.com/', 'Github'],
    ['https://web.whatsapp.com/', 'Web Whatsapp'],
    ['https://notion.so/', 'Notion'],
    ['http://localhost:3000/', 'Localhost']
  ])('%s → %s', (url, name) => {
    expect(defaultName(url)).toBe(name)
  })
})
