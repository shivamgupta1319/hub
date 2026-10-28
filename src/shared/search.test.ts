import { describe, expect, it } from 'vitest'
import { rankSites } from './search'
import type { Site } from './site'

const site = (name: string, url: string): Site => ({
  id: name,
  name,
  url,
  keepAlive: false,
  notifications: true,
  createdAt: 0
})

const sites = [
  site('Team calendar', 'https://calendar.google.com/'),
  site('Gmail', 'https://mail.google.com/'),
  site('GitHub', 'https://github.com/'),
  site('Linear', 'https://linear.app/')
]
const names = (q: string) => rankSites(sites, q).map((s) => s.name)

describe('rankSites', () => {
  it('returns everything in order for an empty query', () => {
    expect(names('  ')).toEqual(['Team calendar', 'Gmail', 'GitHub', 'Linear'])
  })
  it('ranks name prefixes first, keeping sidebar order among equals', () => {
    expect(names('g')).toEqual(['Gmail', 'GitHub', 'Team calendar'])
  })
  it('matches word starts, then anywhere, then the address', () => {
    expect(names('cal')).toEqual(['Team calendar'])
    expect(names('hub')).toEqual(['GitHub'])
    expect(names('linear.app')).toEqual(['Linear'])
  })
  it('returns nothing when nothing matches', () => {
    expect(names('zzz')).toEqual([])
  })
})
