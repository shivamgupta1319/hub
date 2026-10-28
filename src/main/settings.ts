import { existsSync, readFileSync } from 'node:fs'
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from '@shared/settings'
import { writeJsonAtomic } from './jsonFile'

/** App preferences in one JSON file. Unknown or invalid values fall back to defaults. */
export class SettingsStore {
  private value: Settings

  constructor(private readonly filePath: string) {
    this.value = this.load()
  }

  get(): Settings {
    return { ...this.value }
  }

  update(patch: Partial<Settings>): Settings {
    this.value = settingsSchema.parse({ ...this.value, ...patch })
    writeJsonAtomic(this.filePath, this.value)
    return this.get()
  }

  private load(): Settings {
    if (!existsSync(this.filePath)) return { ...DEFAULT_SETTINGS }
    try {
      const raw: unknown = JSON.parse(readFileSync(this.filePath, 'utf8'))
      const merged = { ...DEFAULT_SETTINGS, ...(typeof raw === 'object' ? raw : {}) }
      return settingsSchema.parse(merged)
    } catch (err) {
      console.error('settings file was unreadable; using defaults', err)
      return { ...DEFAULT_SETTINGS }
    }
  }
}
