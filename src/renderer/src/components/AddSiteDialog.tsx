import { AddSiteBar } from './AddSiteBar'
import { Dialog } from './Dialog'

interface Props {
  onClose: () => void
  onAdded: (name: string) => void
}

/** Adds a site from anywhere (sidebar + or Ctrl+N) and opens it, without visiting the dashboard. */
export function AddSiteDialog({ onClose, onAdded }: Props): React.JSX.Element {
  return (
    <Dialog title="Add a site" onClose={onClose}>
      <AddSiteBar
        inputId="add-site-dialog-input"
        autoFocus
        label="Website address"
        onAdded={(site) => {
          onAdded(site.name)
          void window.hub.view.open(site.id)
        }}
      />
      <div className="dialog-actions">
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  )
}
