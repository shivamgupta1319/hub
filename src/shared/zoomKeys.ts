/** The parts of a key press that zoom shortcuts depend on (a subset of Electron's `Input`). */
export interface KeyPress {
  type: string
  key: string
  code: string
  control: boolean
  meta: boolean
  alt: boolean
}

/**
 * Maps a key press to a zoom step the way Chrome does: Ctrl with + or = zooms in, Ctrl with -
 * zooms out and Ctrl+0 resets, on the main keys or the number pad, with or without Shift.
 */
export function zoomStep(input: KeyPress): -1 | 0 | 1 | null {
  if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return null
  if (input.code === 'NumpadAdd' || input.key === '+' || input.key === '=') return 1
  if (input.code === 'NumpadSubtract' || input.key === '-' || input.key === '_') return -1
  if (input.code === 'Numpad0' || input.code === 'Digit0') return 0
  return null
}
