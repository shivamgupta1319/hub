import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { desktopEntry, quoteExecArg, setLaunchAtLogin } from './autostart'

describe('quoteExecArg', () => {
  it('leaves plain paths alone and quotes the rest', () => {
    expect(quoteExecArg('/opt/Hub/hub')).toBe('/opt/Hub/hub')
    expect(quoteExecArg('/home/me/My Apps/Hub.AppImage')).toBe('"/home/me/My Apps/Hub.AppImage"')
    expect(quoteExecArg('/tmp/a"b$c')).toBe('"/tmp/a\\"b\\$c"')
  })
})

describe('desktopEntry', () => {
  it('launches the given command hidden', () => {
    expect(desktopEntry(['/opt/Hub/hub'])).toContain('Exec=/opt/Hub/hub --hidden\n')
  })
})

describe('setLaunchAtLogin', () => {
  const previous = process.env['XDG_CONFIG_HOME']
  afterEach(() => {
    if (previous === undefined) delete process.env['XDG_CONFIG_HOME']
    else process.env['XDG_CONFIG_HOME'] = previous
  })

  it('writes and removes the autostart entry', () => {
    const config = mkdtempSync(join(tmpdir(), 'hub-xdg-'))
    process.env['XDG_CONFIG_HOME'] = config
    const entry = join(config, 'autostart', 'hub.desktop')

    setLaunchAtLogin(true, ['/opt/Hub/hub'])
    expect(readFileSync(entry, 'utf8')).toContain('Exec=/opt/Hub/hub --hidden')
    setLaunchAtLogin(false, ['/opt/Hub/hub'])
    expect(existsSync(entry)).toBe(false)
    setLaunchAtLogin(false, ['/opt/Hub/hub'])
  })
})
