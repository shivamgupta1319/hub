import { useState } from 'react'
import type { Site } from '@shared/site'
import { Dashboard } from './components/Dashboard'
import { EditSiteDialog } from './components/EditSiteDialog'
import { Sidebar } from './components/Sidebar'
import { SiteStage } from './components/SiteStage'
import { useActiveSite } from './hooks/useActiveSite'
import { useSites } from './hooks/useSites'

export function App(): React.JSX.Element {
  const { state, reload } = useSites()
  const { activeId, statuses } = useActiveSite()
  const [editingId, setEditingId] = useState<string>()
  const [status, setStatus] = useState('')

  const sites = state.status === 'ready' ? state.sites : []
  const find = (id: string | null | undefined): Site | undefined => sites.find((s) => s.id === id)
  const activeSite = find(activeId)
  const editing = find(editingId)

  return (
    <div className="shell">
      <Sidebar sites={sites} activeId={activeId} statuses={statuses} />
      <main className="content" id="content">
        {activeSite ? (
          <SiteStage
            site={activeSite}
            status={statuses.get(activeSite.id)}
            onEdit={() => setEditingId(activeSite.id)}
          />
        ) : (
          <Dashboard
            state={state}
            reload={reload}
            onEdit={(site) => setEditingId(site.id)}
            onStatus={setStatus}
          />
        )}
      </main>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {editing && (
        <EditSiteDialog
          site={editing}
          onClose={() => setEditingId(undefined)}
          onRemoved={(name) => {
            setEditingId(undefined)
            setStatus(`Removed ${name}.`)
          }}
        />
      )}
    </div>
  )
}
