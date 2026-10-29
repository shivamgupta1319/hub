import { describe, expect, it } from 'vitest'
import { AltTap } from './altTap'
import type { KeyPress } from './zoomKeys'

const key = (type: 'keyDown' | 'keyUp', k: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  type,
  key: k,
  code: k === 'Alt' ? 'AltLeft' : k,
  control: false,
  meta: false,
  alt: k === 'Alt',
  ...extra
})

describe('AltTap', () => {
  it('fires when Alt is pressed and released on its own', () => {
    const tap = new AltTap()
    expect(tap.feed(key('keyDown', 'Alt'))).toBe(false)
    expect(tap.feed(key('keyUp', 'Alt'))).toBe(true)
  })

  it('ignores Alt used with another key', () => {
    const tap = new AltTap()
    tap.feed(key('keyDown', 'Alt'))
    tap.feed(key('keyDown', 'ArrowLeft', { alt: true }))
    tap.feed(key('keyUp', 'ArrowLeft', { alt: true }))
    expect(tap.feed(key('keyUp', 'Alt'))).toBe(false)
  })

  it('ignores Ctrl+Alt', () => {
    const tap = new AltTap()
    tap.feed(key('keyDown', 'Alt', { control: true }))
    expect(tap.feed(key('keyUp', 'Alt'))).toBe(false)
  })

  it('fires once per tap', () => {
    const tap = new AltTap()
    tap.feed(key('keyDown', 'Alt'))
    tap.feed(key('keyUp', 'Alt'))
    expect(tap.feed(key('keyUp', 'Alt'))).toBe(false)
  })
})
