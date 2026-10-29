import { useId, useRef, useState } from 'react'
import { normalizeUrl, type Site } from '@shared/site'

interface Props {
  onAdded: (site: Site) => void
  /** The input's id; the dashboard's is the target of Ctrl+N focus and must stay unique. */
  inputId?: string
  autoFocus?: boolean
  label?: string
}

export function AddSiteBar({
  onAdded,
  inputId = 'add-site-input',
  autoFocus = false,
  label = 'Add a website'
}: Props): React.JSX.Element {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const errorId = useId()

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    const url = normalizeUrl(value)
    if (!url.ok) {
      setError(url.error)
      input.current?.focus()
      return
    }
    setPending(true)
    try {
      const result = await window.hub.sites.add({ name: '', url: url.value })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setValue('')
      setError(undefined)
      onAdded(result.value)
    } catch {
      setError('Hub couldn’t save the site. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="add-bar" onSubmit={(e) => void submit(e)} noValidate>
      <label htmlFor={inputId} className="add-label">
        {label}
      </label>
      <div className="add-row">
        <input
          ref={input}
          id={inputId}
          autoFocus={autoFocus}
          className="field"
          type="text"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="mail.google.com"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(undefined)
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Adding…' : 'Add site'}
        </button>
      </div>
      {error && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
