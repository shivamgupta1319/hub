import { describe, expect, it } from 'vitest'
import { zoomStep, type KeyPress } from './zoomKeys'

const press = (key: string, code: string, extra: Partial<KeyPress> = {}): KeyPress => ({
  type: 'keyDown',
  key,
  code,
  control: true,
  meta: false,
  alt: false,
  ...extra
})

describe('zoomStep', () => {
  it.each([
    [press('=', 'Equal'), 1],
    [press('+', 'Equal'), 1],
    [press('+', 'NumpadAdd'), 1],
    [press('-', 'Minus'), -1],
    [press('_', 'Minus'), -1],
    [press('-', 'NumpadSubtract'), -1],
    [press('0', 'Digit0'), 0],
    [press('0', 'Numpad0'), 0],
    [press(')', 'Digit0'), 0]
  ])('maps Ctrl+%o', (input, step) => {
    expect(zoomStep(input)).toBe(step)
  })

  it('ignores key presses that aren’t zoom shortcuts', () => {
    expect(zoomStep(press('=', 'Equal', { control: false }))).toBeNull()
    expect(zoomStep(press('=', 'Equal', { alt: true }))).toBeNull()
    expect(zoomStep(press('=', 'Equal', { type: 'keyUp' }))).toBeNull()
    expect(zoomStep(press('1', 'Digit1'))).toBeNull()
  })
})
