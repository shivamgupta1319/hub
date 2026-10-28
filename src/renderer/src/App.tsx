import { useEffect, useState } from 'react'
import type { SiteCommand } from '@shared/ipc'
import type { Site } from '@shared/site'
import { Dashboard } from './components/Dashboard'
import { EditSiteDialog } from './components/EditSiteDialog'
import { Sidebar } from './components/Sidebar'
import { SiteStage } from './components/SiteStage'
import { useActiveSite } from './hooks/useActiveSite'
import { useSites } from './hooks/useSites'

export function App(): React.JSX.Element {
  const { state, reload } = useSites()
  const { activeId, statuses, badges } = useActiveSite()
  const [editing, setEditing] = useState<{ id: string; command: SiteCommand }>()
  const [status, setStatus] = useState('')

  useEffect(() => window.hub.view.onSiteCommand((id, command) => setEditing({ id, command })), [])

  const sites = state.status === 'ready' ? state.sites : []
  const find = (id: string | null | undefined): Site | undefined => sites.find((s) => s.id === id)
  const activeSite = find(activeId)
  const editingSite = find(editing?.id)

  return (
    <div className="shell">
      <Sidebar sites={sites} activeId={activeId} statuses={statuses} badges={badges} />
      <main className="content" id="content">
        {activeSite ? (
          <SiteStage
            site={activeSite}
            status={statuses.get(activeSite.id)}
            onEdit={() => setEditing({ id: activeSite.id, command: 'edit' })}
          />
        ) : (
          <Dashboard
            state={state}
            reload={reload}
            onEdit={(site) => setEditing({ id: site.id, command: 'edit' })}
            onStatus={setStatus}
          />
        )}
      </main>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      {editing && editingSite && (
        <EditSiteDialog
          key={`${editing.id}-${editing.command}`}
          site={editingSite}
          startWithRemove={editing.command === 'remove'}
          onClose={() => setEditing(undefined)}
          onRemoved={(name) => {
            setEditing(undefined)
            setStatus(`Removed ${name}.`)
          }}
        />
      )}
    </div>
  )
}
