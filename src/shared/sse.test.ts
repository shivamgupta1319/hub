import { describe, expect, it } from 'vitest'
import { ChatStreamParser } from './sse'

const event = (content: string): string =>
  `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`

describe('ChatStreamParser', () => {
  it('returns the text pieces and notices [DONE]', () => {
    const parser = new ChatStreamParser()
    expect(parser.push(event('Hel') + event('lo'))).toEqual(['Hel', 'lo'])
    expect(parser.push('data: [DONE]\n\n')).toEqual([])
    expect(parser.done).toBe(true)
  })

  it('handles events split across chunks', () => {
    const parser = new ChatStreamParser()
    const whole = event('split')
    expect(parser.push(whole.slice(0, 20))).toEqual([])
    expect(parser.push(whole.slice(20))).toEqual(['split'])
  })

  it('skips comments, keep-alives and role-only deltas', () => {
    const parser = new ChatStreamParser()
    const roleOnly = `data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] })}\n`
    expect(parser.push(': ping\n\n' + roleOnly + 'data: not json\n')).toEqual([])
  })

  it('throws on an error event', () => {
    const parser = new ChatStreamParser()
    expect(() => parser.push(`data: ${JSON.stringify({ error: { message: 'busy' } })}\n`)).toThrow(
      'busy'
    )
  })
})
