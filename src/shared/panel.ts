export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Panel width on roomy windows; below SHEET_BELOW the panel becomes a bottom sheet instead. */
export const PANEL_WIDTH = 420
export const SHEET_BELOW = 560
const GAP = 8

/**
 * Where the writing panel goes: just below the click if it fits, otherwise above it, always
 * inside `area` (the site's part of the window). Narrow areas get a full-width bottom sheet.
 */
export function placePanel(anchor: { x: number; y: number }, height: number, area: Rect): Rect {
  const h = Math.min(height, area.height - 2 * GAP)
  if (area.width < SHEET_BELOW) {
    return { x: area.x, y: area.y + area.height - h, width: area.width, height: h }
  }
  const width = Math.min(PANEL_WIDTH, area.width - 2 * GAP)
  const x = Math.min(Math.max(anchor.x, area.x + GAP), area.x + area.width - width - GAP)
  const below = anchor.y + GAP
  const fitsBelow = below + h <= area.y + area.height - GAP
  const above = anchor.y - GAP - h
  const y = fitsBelow ? below : above >= area.y + GAP ? above : area.y + area.height - h - GAP
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(h) }
}
