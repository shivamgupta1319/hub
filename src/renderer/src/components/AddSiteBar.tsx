import { useId, useRef, useState } from 'react'
import { normalizeUrl } from '@shared/site'

interface Props {
  onAdded: (name: string) => void
}

export function AddSiteBar({ onAdded }: Props): React.JSX.Element {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inputId = useId()
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
      onAdded(result.value.name)
    } catch {
      setError('Hub couldn’t save the site. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="add-bar" onSubmit={(e) => void submit(e)} noValidate>
      <label htmlFor={inputId} className="add-label">
        Add a website
      </label>
      <div className="add-row">
        <input
          ref={input}
          id={inputId}
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
