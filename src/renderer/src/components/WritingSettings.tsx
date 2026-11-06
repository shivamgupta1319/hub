import { useEffect, useId, useState } from 'react'
import type { AiKeyStatus } from '@shared/ipc'
import { AI_MODEL_CHOICES, settingsSchema, type Settings } from '@shared/settings'

interface Props {
  settings: Settings
  change: (patch: Partial<Settings>) => Promise<void>
}

type Check =
  { state: 'idle' } | { state: 'testing' } | { state: 'ok' } | { state: 'failed'; error: string }

/** "Help me write": on/off, the AI router's address, its key (stored encrypted) and the model. */
export function WritingSettings({ settings, change }: Props): React.JSX.Element {
  const [keyStatus, setKeyStatus] = useState<AiKeyStatus>()
  const [key, setKey] = useState('')
  const [keyError, setKeyError] = useState<string>()
  const [address, setAddress] = useState(settings.aiBaseUrl)
  const [addressError, setAddressError] = useState<string>()
  const [check, setCheck] = useState<Check>({ state: 'idle' })
  const onId = useId()
  const onHintId = useId()
  const addressId = useId()
  const keyId = useId()
  const keyHintId = useId()
  const modelId = useId()

  useEffect(() => {
    window.hub.ai
      .keyStatus()
      .then(setKeyStatus)
      .catch(() => setKeyError('Hub couldn’t check for a saved key.'))
  }, [])

  async function saveKey(next: string | null): Promise<void> {
    setCheck({ state: 'idle' })
    try {
      const result = await window.hub.ai.setKey(next)
      if (result.ok) {
        setKeyStatus(result.value)
        setKey('')
        setKeyError(undefined)
      } else {
        setKeyError(result.error)
      }
    } catch {
      setKeyError('Hub couldn’t save the key. Try again.')
    }
  }

  async function saveAddress(): Promise<void> {
    const value = address.trim()
    if (value === settings.aiBaseUrl) return
    if (!settingsSchema.shape.aiBaseUrl.safeParse(value).success) {
      setAddressError('Enter the router’s full address, like https://ai.example.com/v1.')
      return
    }
    setAddressError(undefined)
    setCheck({ state: 'idle' })
    await change({ aiBaseUrl: value })
  }

  async function test(): Promise<void> {
    setCheck({ state: 'testing' })
    try {
      const result = await window.hub.ai.test()
      setCheck(result.ok ? { state: 'ok' } : { state: 'failed', error: result.error })
    } catch {
      setCheck({ state: 'failed', error: 'The test didn’t run. Try again.' })
    }
  }

  return (
    <fieldset className="settings-group">
      <legend className="settings-legend">Writing help</legend>
      <div className="check-field">
        <input
          id={onId}
          type="checkbox"
          checked={settings.writingHelp}
          aria-describedby={onHintId}
          onChange={(e) => void change({ writingHelp: e.target.checked })}
        />
        <div>
          <label htmlFor={onId}>Show “Help me write” when I right-click text</label>
          <p id={onHintId} className="field-hint">
            Fix grammar, change the tone or draft text with AI. The text you pick is sent to your AI
            router, which passes it to its AI providers.
          </p>
        </div>
      </div>

      {settings.writingHelp && (
        <>
          <div className="form-field">
            <label htmlFor={addressId}>AI router address</label>
            <input
              id={addressId}
              className="field"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={address}
              aria-invalid={addressError ? true : undefined}
              onChange={(e) => setAddress(e.target.value)}
              onBlur={() => void saveAddress()}
            />
            {addressError && (
              <p className="field-error" role="alert">
                {addressError}
              </p>
            )}
          </div>

          <form
            className="form-field"
            onSubmit={(e) => {
              e.preventDefault()
              if (key.trim()) void saveKey(key)
            }}
          >
            <label htmlFor={keyId}>Router key</label>
            <div className="add-row">
              <input
                id={keyId}
                className="field"
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  keyStatus?.saved ? 'Saved — paste a new one to replace it' : 'ar_hub_…'
                }
                value={key}
                aria-describedby={keyHintId}
                aria-invalid={keyError ? true : undefined}
                onChange={(e) => setKey(e.target.value)}
              />
              <button type="submit" className="btn" disabled={!key.trim()}>
                Save key
              </button>
            </div>
            <p id={keyHintId} className="field-hint">
              {keyStatus?.saved ? 'A key is saved, encrypted with your system keyring. ' : ''}
              {keyStatus && !keyStatus.canStore
                ? 'No system keyring is available, so Hub can’t store a key.'
                : 'Mint one on the router with: mint-key.js mint hub'}
            </p>
            {keyError && (
              <p className="field-error" role="alert">
                {keyError}
              </p>
            )}
          </form>

          <div className="form-field">
            <label htmlFor={modelId}>Model</label>
            <select
              id={modelId}
              className="field"
              value={settings.aiModel}
              onChange={(e) => {
                setCheck({ state: 'idle' })
                void change({ aiModel: e.target.value })
              }}
            >
              {AI_MODEL_CHOICES.map((c) => (
                <option key={c.model} value={c.model}>
                  {c.label}
                </option>
              ))}
              {!AI_MODEL_CHOICES.some((c) => c.model === settings.aiModel) && (
                <option value={settings.aiModel}>{settings.aiModel}</option>
              )}
            </select>
          </div>

          <div className="settings-test">
            <button
              type="button"
              className="btn"
              disabled={!keyStatus?.saved || check.state === 'testing'}
              onClick={() => void test()}
            >
              {check.state === 'testing' ? 'Testing…' : 'Test connection'}
            </button>
            {keyStatus?.saved && (
              <button
                type="button"
                className="btn btn-quiet-danger"
                onClick={() => void saveKey(null)}
              >
                Remove key
              </button>
            )}
            <p className="settings-test-result" role="status">
              {check.state === 'ok' && 'Connected — writing help is ready.'}
              {check.state === 'failed' && <span className="text-danger">{check.error}</span>}
            </p>
          </div>
        </>
      )}
    </fieldset>
  )
}
