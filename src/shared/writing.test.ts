import { describe, expect, it } from 'vitest'
import { actionLabel, buildMessages, cleanResult, MAX_INPUT_CHARS } from './writing'

describe('buildMessages', () => {
  it('puts the selection in <text> tags after the instruction, with where it is written', () => {
    const [system, user] = buildMessages({ kind: 'fix' }, 'teh cat', {
      site: 'mail.google.com',
      pageTitle: 'Inbox'
    })
    expect(system?.role).toBe('system')
    expect(system?.content).toMatch(/only the resulting text/)
    expect(user?.content).toContain('mail.google.com — Inbox')
    expect(user?.content).toMatch(/Fix spelling, grammar/)
    expect(user?.content).toMatch(/<text>\nteh cat\n<\/text>$/)
  })

  it('names the tone', () => {
    const [, user] = buildMessages({ kind: 'tone', tone: 'casual' }, 'Dear sir')
    expect(user?.content).toContain('casual tone')
  })

  it('drafts from the instruction, with the field text as context', () => {
    const [, user] = buildMessages({ kind: 'draft', instruction: ' decline the meeting ' }, '', {
      fieldText: 'Hi Sam,'
    })
    expect(user?.content).toContain('Write this: decline the meeting')
    expect(user?.content).toContain('<text>\nHi Sam,\n</text>')
  })

  it('drafts without context when the field is empty', () => {
    const [, user] = buildMessages({ kind: 'draft', instruction: 'a thank-you note' }, '')
    expect(user?.content).not.toContain('<text>')
  })

  it('caps long selections', () => {
    const [, user] = buildMessages({ kind: 'improve' }, 'a'.repeat(MAX_INPUT_CHARS + 500))
    expect(user?.content.length).toBeLessThan(MAX_INPUT_CHARS + 300)
  })

  it('adds a follow-up as a second turn', () => {
    const messages = buildMessages(
      { kind: 'fix' },
      'x',
      {},
      { previous: 'X.', instruction: 'warmer' }
    )
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user'])
    expect(messages[3]?.content).toContain('warmer')
  })
})

describe('actionLabel', () => {
  it('labels each action', () => {
    expect(actionLabel({ kind: 'fix' })).toBe('Fix spelling & grammar')
    expect(actionLabel({ kind: 'tone', tone: 'direct' })).toBe('Direct tone')
  })
})

describe('cleanResult', () => {
  it.each([
    ['  Hello there.  ', 'Hello there.'],
    ['"Hello there."', 'Hello there.'],
    ['“Hello there.”', 'Hello there.'],
    ['```\nHello\nthere\n```', 'Hello\nthere'],
    ['"Yes," she said, "go."', '"Yes," she said, "go."']
  ])('cleans %j', (raw, clean) => {
    expect(cleanResult(raw)).toBe(clean)
  })
})
