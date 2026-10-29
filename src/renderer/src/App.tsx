import { useEffect, useState } from 'react'
import type { SiteCommand } from '@shared/ipc'
import type { Site } from '@shared/site'
import { AddSiteDialog } from './components/AddSiteDialog'
import { Dashboard } from './components/Dashboard'
import { EditSiteDialog } from './components/EditSiteDialog'
import { QuickSwitcher } from './components/QuickSwitcher'
import { SettingsDialog } from './components/SettingsDialog'
import { Sidebar } from './components/Sidebar'
import { SiteStage } from './components/SiteStage'
import { useActiveSite } from './hooks/useActiveSite'
import { useSites } from './hooks/useSites'

export function App(): React.JSX.Element {
  const { state, reload } = useSites()
  const { activeId, statuses, badges } = useActiveSite()
  const [editing, setEditing] = useState<{ id: string; command: SiteCommand }>()
  const [status, setStatus] = useState('')

  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => window.hub.view.onSiteCommand((id, command) => setEditing({ id, command })), [])
  useEffect(
    () =>
      window.hub.onCommand((command) => {
        if (command === 'quick-switch') setSwitcherOpen(true)
        if (command === 'settings') setSettingsOpen(true)
        if (command === 'add-site') setAddOpen(true)
      }),
    []
  )

  const sites = state.status === 'ready' ? state.sites : []
  const find = (id: string | null | undefined): Site | undefined => sites.find((s) => s.id === id)
  const activeSite = find(activeId)
  const editingSite = find(editing?.id)

  return (
    <div className="shell">
      <Sidebar
        sites={sites}
        activeId={activeId}
        statuses={statuses}
        badges={badges}
        onAdd={() => setAddOpen(true)}
        onSettings={() => setSettingsOpen(true)}
      />
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
      {addOpen && (
        <AddSiteDialog
          onClose={() => setAddOpen(false)}
          onAdded={(name) => {
            setAddOpen(false)
            setStatus(`Added ${name}.`)
          }}
        />
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {switcherOpen && <QuickSwitcher sites={sites} onClose={() => setSwitcherOpen(false)} />}
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
