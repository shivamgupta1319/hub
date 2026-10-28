import { useEffect, useId, useState } from 'react'
import { SLEEP_CHOICES, type Settings } from '@shared/settings'
import { Dialog } from './Dialog'

interface Props {
  onClose: () => void
}

/** Changes apply as soon as they're made, so there's no Save button. */
export function SettingsDialog({ onClose }: Props): React.JSX.Element {
  const [settings, setSettings] = useState<Settings>()
  const [version, setVersion] = useState('')
  const [error, setError] = useState<string>()
  const sleepId = useId()
  const trayId = useId()
  const loginId = useId()
  const loginHintId = useId()

  useEffect(() => {
    window.hub.settings
      .get()
      .then(setSettings)
      .catch(() => setError('Hub couldn’t read its settings.'))
    window.hub
      .appInfo()
      .then((info) => setVersion(info.version))
      .catch(() => undefined)
  }, [])

  async function change(patch: Partial<Settings>): Promise<void> {
    if (!settings) return
    const previous = settings
    setSettings({ ...settings, ...patch })
    try {
      setSettings(await window.hub.settings.update(patch))
      setError(undefined)
    } catch {
      setSettings(previous)
      setError('Hub couldn’t save that change. Try again.')
    }
  }

  return (
    <Dialog title="Settings" onClose={onClose}>
      {!settings && !error && <p className="dialog-text">Loading…</p>}
      {settings && (
        <div className="form">
          <div className="form-field">
            <label htmlFor={sleepId}>Put unused sites to sleep after</label>
            <select
              id={sleepId}
              className="field"
              value={settings.sleepAfterMinutes}
              onChange={(e) => void change({ sleepAfterMinutes: Number(e.target.value) })}
            >
              {SLEEP_CHOICES.map((c) => (
                <option key={c.minutes} value={c.minutes}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="field-hint">
              Sleeping sites free memory and reload when you open them. Sites set to keep running
              never sleep.
            </p>
          </div>
          <div className="check-field">
            <input
              id={trayId}
              type="checkbox"
              checked={settings.closeToTray}
              onChange={(e) => void change({ closeToTray: e.target.checked })}
            />
            <label htmlFor={trayId}>Keep Hub running in the tray when the window is closed</label>
          </div>
          <div className="check-field">
            <input
              id={loginId}
              type="checkbox"
              checked={settings.launchAtLogin}
              aria-describedby={loginHintId}
              onChange={(e) => void change({ launchAtLogin: e.target.checked })}
            />
            <div>
              <label htmlFor={loginId}>Start Hub when I log in</label>
              <p id={loginHintId} className="field-hint">
                It starts in the tray, so notifications arrive without opening the window.
              </p>
            </div>
          </div>
        </div>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        {version && <span className="dialog-meta">Hub {version}</span>}
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose} autoFocus>
          Done
        </button>
      </div>
    </Dialog>
  )
}
