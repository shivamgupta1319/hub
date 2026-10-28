import { useId, useState } from 'react'
import type { Site } from '@shared/site'
import { NAME_MAX } from '@shared/site'
import { Dialog } from './Dialog'

interface Props {
  site: Site
  onClose: () => void
  onRemoved: (name: string) => void
}

export function EditSiteDialog({ site, onClose, onRemoved }: Props): React.JSX.Element {
  const [name, setName] = useState(site.name)
  const [url, setUrl] = useState(site.url)
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const nameId = useId()
  const urlId = useId()
  const errorId = useId()

  async function save(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setPending(true)
    try {
      const result = await window.hub.sites.update(site.id, { name, url })
      if (result.ok) onClose()
      else setError(result.error)
    } catch {
      setError('Hub couldn’t save your changes. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function remove(): Promise<void> {
    setPending(true)
    try {
      await window.hub.sites.remove(site.id)
      onRemoved(site.name)
    } catch {
      setError('Hub couldn’t remove the site. Try again.')
      setPending(false)
    }
  }

  if (confirmRemove) {
    return (
      <Dialog title={`Remove ${site.name}?`} onClose={onClose}>
        <p className="dialog-text">
          It disappears from the sidebar and you’ll be signed out of it in Hub. The website itself
          isn’t affected.
        </p>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={() => setConfirmRemove(false)} autoFocus>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void remove()}
            disabled={pending}
          >
            {pending ? 'Removing…' : 'Remove site'}
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog title="Edit site" onClose={onClose}>
      <form className="form" onSubmit={(e) => void save(e)} noValidate>
        <div className="form-field">
          <label htmlFor={nameId}>Name</label>
          <input
            id={nameId}
            className="field"
            value={name}
            maxLength={NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-field">
          <label htmlFor={urlId}>Address</label>
          <input
            id={urlId}
            className="field"
            type="text"
            inputMode="url"
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>
        {error && (
          <p id={errorId} className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn-quiet-danger"
            onClick={() => {
              setError(undefined)
              setConfirmRemove(true)
            }}
          >
            Remove…
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
