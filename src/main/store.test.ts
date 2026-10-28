import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { SiteStore } from './store'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hub-store-'))
  file = join(dir, 'sites.json')
})

function unwrap<T>(r: { ok: true; value: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('SiteStore', () => {
  it('adds a site with a normalised URL and a default name, and persists it', () => {
    const store = new SiteStore(file, () => 1000)
    const site = unwrap(store.add({ name: '  ', url: 'mail.google.com' }))
    expect(site).toMatchObject({
      name: 'Mail Google',
      url: 'https://mail.google.com/',
      createdAt: 1000
    })

    expect(new SiteStore(file).list()).toEqual([site])
  })

  it('rejects an invalid URL without saving', () => {
    const store = new SiteStore(file)
    expect(store.add({ name: 'x', url: 'nope' }).ok).toBe(false)
    expect(store.list()).toEqual([])
  })

  it('updates fields and validates them', () => {
    const store = new SiteStore(file)
    const { id } = unwrap(store.add({ name: 'GitHub', url: 'github.com' }))
    expect(unwrap(store.update(id, { name: ' My  GitHub ', keepAlive: true }))).toMatchObject({
      name: 'My GitHub',
      keepAlive: true
    })
    expect(store.update(id, { name: '   ' }).ok).toBe(false)
    expect(store.update(id, { url: 'ftp://x.com' }).ok).toBe(false)
    expect(store.update('missing', { name: 'x' }).ok).toBe(false)
    expect(store.get(id)?.name).toBe('My GitHub')
  })

  it('removes sites', () => {
    const store = new SiteStore(file)
    const { id } = unwrap(store.add({ name: 'A', url: 'a.com' }))
    expect(store.remove(id)).toBe(true)
    expect(store.remove(id)).toBe(false)
    expect(new SiteStore(file).list()).toEqual([])
  })

  it('reorders, keeping unlisted sites at the end', () => {
    const store = new SiteStore(file)
    const [a, b, c] = ['a.com', 'b.com', 'c.com'].map((url) => unwrap(store.add({ name: '', url })))
    store.reorder([c!.id, 'unknown', a!.id])
    expect(store.list().map((s) => s.id)).toEqual([c!.id, a!.id, b!.id])
  })

  it('moves an unreadable file aside and starts empty', () => {
    writeFileSync(file, '{ not json')
    const store = new SiteStore(file, () => 42)
    expect(store.list()).toEqual([])
    expect(readdirSync(dir)).toContain('sites.json.corrupt-42')

    store.add({ name: '', url: 'a.com' })
    expect(JSON.parse(readFileSync(file, 'utf8')).sites).toHaveLength(1)
  })
})
