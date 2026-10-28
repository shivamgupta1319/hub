import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { quoteExecArg } from './autostart'

/** Marks launcher entries Hub wrote itself, so it never deletes one it didn't create. */
const MARKER = 'X-Hub-Generated=true'

function dataHome(): string {
  return process.env['XDG_DATA_HOME'] || join(homedir(), '.local', 'share')
}

export function launcherEntry(command: readonly string[]): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Hub',
    'Comment=Your websites in one app',
    `Exec=${command.map(quoteExecArg).join(' ')} %U`,
    'Icon=hub',
    'Terminal=false',
    'Categories=Network;',
    'StartupWMClass=hub',
    MARKER,
    ''
  ].join('\n')
}

/**
 * The Ubuntu dock (on Wayland) shows the icon of the launcher entry matching the window's app ID
 * ("hub"), not the window icon. The .deb installs that entry system-wide; the AppImage and dev
 * runs don't, so they write one (plus the icons) to ~/.local/share. Passing `command: null`
 * removes Hub's own entry again, e.g. when running from the .deb whose system entry should win.
 */
export function syncLauncherEntry(
  command: readonly string[] | null,
  icons: readonly { file: string; size: '256x256' | 'scalable'; ext: 'png' | 'svg' }[]
): void {
  const entryPath = join(dataHome(), 'applications', 'hub.desktop')
  const ours = existsSync(entryPath) && readFileSync(entryPath, 'utf8').includes(MARKER)

  if (!command) {
    if (ours) rmSync(entryPath)
    return
  }
  // Leave an entry the person (or another installer) made alone.
  if (existsSync(entryPath) && !ours) return

  for (const icon of icons) {
    const dir = join(dataHome(), 'icons', 'hicolor', icon.size, 'apps')
    mkdirSync(dir, { recursive: true })
    copyFileSync(icon.file, join(dir, `hub.${icon.ext}`))
  }
  const content = launcherEntry(command)
  if (ours && readFileSync(entryPath, 'utf8') === content) return
  mkdirSync(join(entryPath, '..'), { recursive: true })
  writeFileSync(entryPath, content)
}
