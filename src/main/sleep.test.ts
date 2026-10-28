import { describe, expect, it } from 'vitest'
import { SleepScheduler } from './sleep'

const MIN = 60_000

function setup() {
  let t = 0
  const scheduler = new SleepScheduler(() => t)
  return { scheduler, advance: (ms: number) => (t += ms) }
}

const opts = (activeId: string | null, keep: string[] = [], afterMs = 30 * MIN) => ({
  activeId,
  afterMs,
  keepAlive: (id: string) => keep.includes(id)
})

describe('SleepScheduler', () => {
  it('sleeps pages idle past the limit, but not the visible one', () => {
    const { scheduler, advance } = setup()
    scheduler.touch('a')
    scheduler.touch('b')
    advance(29 * MIN)
    expect(scheduler.due(['a', 'b'], opts('b'))).toEqual([])
    advance(1 * MIN)
    expect(scheduler.due(['a', 'b'], opts('b'))).toEqual(['a'])
  })

  it('never sleeps keep-alive sites', () => {
    const { scheduler, advance } = setup()
    scheduler.touch('chat')
    advance(10 * 60 * MIN)
    expect(scheduler.due(['chat'], opts(null, ['chat']))).toEqual([])
  })

  it('counts unseen background pages from when they were first checked', () => {
    const { scheduler, advance } = setup()
    expect(scheduler.due(['bg'], opts(null))).toEqual([])
    advance(30 * MIN)
    expect(scheduler.due(['bg'], opts(null))).toEqual(['bg'])
  })

  it('does nothing when sleeping is turned off', () => {
    const { scheduler, advance } = setup()
    scheduler.touch('a')
    advance(100 * 60 * MIN)
    expect(scheduler.due(['a'], opts(null, [], 0))).toEqual([])
  })

  it('touching again resets the clock', () => {
    const { scheduler, advance } = setup()
    scheduler.touch('a')
    advance(25 * MIN)
    scheduler.touch('a')
    advance(25 * MIN)
    expect(scheduler.due(['a'], opts(null))).toEqual([])
  })
})
