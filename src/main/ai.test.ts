import { describe, expect, it } from 'vitest'
import { errorForStatus } from './ai'

describe('errorForStatus', () => {
  it.each([
    [401, 'auth'],
    [403, 'auth'],
    [429, 'busy'],
    [503, 'busy'],
    [400, 'bad-request']
  ] as const)('maps %i to %s', (status, kind) => {
    expect(errorForStatus(status, '').kind).toBe(kind)
  })

  it('passes on the router’s reason for a refusal', () => {
    const err = errorForStatus(400, '{"error":{"message":"unknown model"}}')
    expect(err.message).toBe('The AI router refused: unknown model')
  })
})
