import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { launcherEntry, syncLauncherEntry } from './desktopIntegration'

let data: string
let icon: string
const previous = process.env['XDG_DATA_HOME']

beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), 'hub-data-'))
  process.env['XDG_DATA_HOME'] = data
  icon = join(data, 'source.png')
  writeFileSync(icon, 'png')
})
afterEach(() => {
  if (previous === undefined) delete process.env['XDG_DATA_HOME']
  else process.env['XDG_DATA_HOME'] = previous
})

const entry = (): string => join(data, 'applications', 'hub.desktop')
const icons = (): { file: string; size: '256x256'; ext: 'png' }[] => [
  { file: icon, size: '256x256', ext: 'png' }
]

describe('syncLauncherEntry', () => {
  it('installs the launcher entry and icon, matching the window app ID', () => {
    syncLauncherEntry(['/apps/Hub.AppImage'], icons())
    const text = readFileSync(entry(), 'utf8')
    expect(text).toContain('Exec=/apps/Hub.AppImage %U')
    expect(text).toContain('StartupWMClass=hub')
    expect(existsSync(join(data, 'icons/hicolor/256x256/apps/hub.png'))).toBe(true)
  })

  it('removes only its own entry', () => {
    syncLauncherEntry(['/apps/Hub.AppImage'], icons())
    syncLauncherEntry(null, icons())
    expect(existsSync(entry())).toBe(false)

    mkdirSync(join(data, 'applications'), { recursive: true })
    writeFileSync(entry(), '[Desktop Entry]\nName=Mine\n')
    syncLauncherEntry(null, icons())
    syncLauncherEntry(['/apps/Hub.AppImage'], icons())
    expect(readFileSync(entry(), 'utf8')).toBe('[Desktop Entry]\nName=Mine\n')
  })

  it('quotes paths with spaces', () => {
    expect(launcherEntry(['/home/me/My Apps/Hub.AppImage'])).toContain(
      'Exec="/home/me/My Apps/Hub.AppImage" %U'
    )
  })
})
