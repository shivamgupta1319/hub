import { z } from 'zod'

export const settingsSchema = z.object({
  /** Minutes before an unused background site sleeps; 0 = never. */
  sleepAfterMinutes: z
    .number()
    .int()
    .min(0)
    .max(24 * 60),
  /** Closing the window hides Hub to the tray instead of quitting. */
  closeToTray: z.boolean(),
  /** Start Hub (in the tray) when you log in. */
  launchAtLogin: z.boolean()
})

export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  sleepAfterMinutes: 30,
  closeToTray: true,
  launchAtLogin: false
}

export const SLEEP_CHOICES: readonly { minutes: number; label: string }[] = [
  { minutes: 5, label: '5 minutes' },
  { minutes: 15, label: '15 minutes' },
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 0, label: 'Never' }
]
