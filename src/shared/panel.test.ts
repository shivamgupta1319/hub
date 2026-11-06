import { describe, expect, it } from 'vitest'
import { PANEL_WIDTH, placePanel } from './panel'

const area = { x: 64, y: 36, width: 1216, height: 784 }

describe('placePanel', () => {
  it('goes just below the click', () => {
    expect(placePanel({ x: 300, y: 200 }, 300, area)).toEqual({
      x: 300,
      y: 208,
      width: PANEL_WIDTH,
      height: 300
    })
  })

  it('flips above the click near the bottom', () => {
    const rect = placePanel({ x: 300, y: 760 }, 300, area)
    expect(rect.y + rect.height).toBe(752)
  })

  it('stays inside the area on the right edge', () => {
    const rect = placePanel({ x: 1250, y: 200 }, 300, area)
    expect(rect.x + rect.width).toBe(area.x + area.width - 8)
  })

  it('never grows taller than the area', () => {
    const rect = placePanel({ x: 300, y: 400 }, 5000, area)
    expect(rect.height).toBe(area.height - 16)
    expect(rect.y).toBeGreaterThanOrEqual(area.y)
  })

  it('becomes a full-width bottom sheet in narrow windows', () => {
    const narrow = { x: 64, y: 36, width: 326, height: 604 }
    expect(placePanel({ x: 100, y: 100 }, 280, narrow)).toEqual({
      x: 64,
      y: 36 + 604 - 280,
      width: 326,
      height: 280
    })
  })
})
