import type { KeyPress } from './zoomKeys'

/**
 * Recognises Alt pressed and released on its own, which opens the menu the way a native menu
 * bar does. Alt used as a modifier (Alt+← for back) doesn't count.
 */
export class AltTap {
  private armed = false

  /** Feed every key event; returns true when this one completes a tap. */
  feed(input: KeyPress): boolean {
    const isAlt = input.key === 'Alt'
    if (input.type === 'keyDown') {
      this.armed = isAlt && !input.control && !input.meta
      return false
    }
    if (input.type === 'keyUp' && isAlt && this.armed) {
      this.armed = false
      return true
    }
    return false
  }
}
