import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/settings'
import { SettingsStore } from './settings'

const file = (): string => join(mkdtempSync(join(tmpdir(), 'hub-settings-')), 'settings.json')

describe('SettingsStore', () => {
  it('starts with defaults and persists updates', () => {
    const path = file()
    expect(new SettingsStore(path).get()).toEqual(DEFAULT_SETTINGS)
    new SettingsStore(path).update({ sleepAfterMinutes: 0, launchAtLogin: true })
    expect(new SettingsStore(path).get()).toEqual({
      ...DEFAULT_SETTINGS,
      sleepAfterMinutes: 0,
      launchAtLogin: true
    })
  })

  it('rejects invalid values without saving them', () => {
    const path = file()
    const store = new SettingsStore(path)
    expect(() => store.update({ sleepAfterMinutes: -5 })).toThrow()
    expect(store.get()).toEqual(DEFAULT_SETTINGS)
  })

  it('fills missing keys with defaults and ignores a corrupt file', () => {
    const path = file()
    writeFileSync(path, JSON.stringify({ closeToTray: false }))
    expect(new SettingsStore(path).get()).toEqual({ ...DEFAULT_SETTINGS, closeToTray: false })
    writeFileSync(path, '{ nope')
    expect(new SettingsStore(path).get()).toEqual(DEFAULT_SETTINGS)
    expect(readFileSync(path, 'utf8')).toBe('{ nope')
  })
})
