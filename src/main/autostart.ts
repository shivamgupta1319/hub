import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Passed by the autostart entry so Hub starts in the tray instead of opening its window. */
export const HIDDEN_FLAG = '--hidden'

function autostartPath(): string {
  const config = process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config')
  return join(config, 'autostart', 'hub.desktop')
}

/** Quotes one argument for a .desktop Exec line (Desktop Entry spec, "Exec key"). */
export function quoteExecArg(arg: string): string {
  if (!/[\s"'\\$`]/.test(arg)) return arg
  return `"${arg.replace(/([\\"$`])/g, '\\$1')}"`
}

export function desktopEntry(command: readonly string[]): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Hub',
    'Comment=Your websites in one app',
    `Exec=${[...command, HIDDEN_FLAG].map(quoteExecArg).join(' ')}`,
    'Icon=hub',
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
}

/**
 * Electron's setLoginItemSettings does nothing on Linux, so write (or remove) an XDG autostart
 * entry. `command` launches this exact build: the AppImage, the installed binary, or in
 * development Electron plus the app folder.
 */
export function setLaunchAtLogin(enabled: boolean, command: readonly string[]): void {
  const path = autostartPath()
  if (!enabled) {
    if (existsSync(path)) rmSync(path)
    return
  }
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, desktopEntry(command))
}
