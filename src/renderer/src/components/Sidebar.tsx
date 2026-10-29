import { useState } from 'react'
import { badgeLabel, type Badge } from '@shared/badges'
import type { ViewStatus } from '@shared/ipc'
import type { Site } from '@shared/site'
import { GearIcon, HomeIcon, PlusIcon } from './icons'
import { SiteAvatar } from './SiteAvatar'

interface Props {
  sites: Site[]
  activeId: string | null
  statuses: ReadonlyMap<string, ViewStatus>
  badges: ReadonlyMap<string, Badge>
  onAdd: () => void
  onSettings: () => void
}

function describe(site: Site, state: ViewStatus['state'] | undefined, badge: Badge): string {
  if (state === 'error' || state === 'crashed') return `${site.name} (didn’t load)`
  if (state === 'sleeping') return `${site.name} (asleep)`
  if (typeof badge === 'number') return `${site.name}, ${badge} unread`
  if (badge === 'dot') return `${site.name}, new activity`
  return site.name
}

/** Moves `id` so it ends up before the site currently at `dropIndex` (or last). */
function reordered(ids: string[], id: string, dropIndex: number): string[] {
  const from = ids.indexOf(id)
  const without = ids.filter((x) => x !== id)
  const at = dropIndex > from ? dropIndex - 1 : dropIndex
  return [...without.slice(0, at), id, ...without.slice(at)]
}

export function Sidebar({
  sites,
  activeId,
  statuses,
  badges,
  onAdd,
  onSettings
}: Props): React.JSX.Element {
  // Drag to reorder; the sidebar's right-click menu offers Move up/down for keyboard users.
  const [dragId, setDragId] = useState<string>()
  const [dropIndex, setDropIndex] = useState<number>()

  function drop(): void {
    if (dragId !== undefined && dropIndex !== undefined) {
      const ids = sites.map((s) => s.id)
      const next = reordered(ids, dragId, dropIndex)
      if (next.join() !== ids.join()) void window.hub.sites.reorder(next)
    }
    setDragId(undefined)
    setDropIndex(undefined)
  }

  return (
    <nav className="sidebar" aria-label="Sites">
      <button
        type="button"
        className={`dock-item${activeId === null ? ' is-active' : ''}`}
        aria-label="All sites"
        aria-current={activeId === null ? 'page' : undefined}
        title="All sites"
        onClick={() => void window.hub.view.home()}
      >
        <HomeIcon />
      </button>
      {sites.length > 0 && <div className="dock-divider" role="separator" />}
      <ul className="dock-list">
        {sites.map((site, index) => {
          const state = statuses.get(site.id)?.state
          const active = site.id === activeId
          const broken = state === 'error' || state === 'crashed'
          const asleep = state === 'sleeping'
          const badge = badges.get(site.id) ?? null
          return (
            <li
              key={site.id}
              draggable
              className={[
                dragId === site.id ? 'is-dragging' : '',
                dragId !== undefined && dropIndex === index ? 'drop-before' : '',
                dragId !== undefined && dropIndex === sites.length && index === sites.length - 1
                  ? 'drop-after'
                  : ''
              ]
                .filter(Boolean)
                .join(' ')}
              onDragStart={(e) => {
                setDragId(site.id)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', site.id)
              }}
              onDragOver={(e) => {
                if (dragId === undefined) return
                e.preventDefault()
                const box = e.currentTarget.getBoundingClientRect()
                setDropIndex(e.clientY < box.top + box.height / 2 ? index : index + 1)
              }}
              onDrop={(e) => {
                e.preventDefault()
                drop()
              }}
              onDragEnd={() => {
                setDragId(undefined)
                setDropIndex(undefined)
              }}
            >
              <button
                type="button"
                className={`dock-item${active ? ' is-active' : ''}${asleep ? ' is-asleep' : ''}`}
                aria-label={describe(site, state, badge)}
                aria-current={active ? 'page' : undefined}
                title={asleep ? `${site.name} — asleep, opens fresh` : site.name}
                onClick={() => void window.hub.view.open(site.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  void window.hub.view.showSiteMenu(site.id)
                }}
              >
                <SiteAvatar site={site} size={30} />
                {state === 'loading' && <span className="dock-loading" aria-hidden="true" />}
                {broken && <span className="dock-alert" aria-hidden="true" />}
                {!broken && typeof badge === 'number' && (
                  <span className="dock-badge" aria-hidden="true">
                    {badgeLabel(badge)}
                  </span>
                )}
                {!broken && badge === 'dot' && <span className="dock-dot" aria-hidden="true" />}
              </button>
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className="dock-item dock-add"
        aria-label="Add a site"
        title="Add a site (Ctrl+N)"
        onClick={onAdd}
      >
        <PlusIcon />
      </button>
      <button
        type="button"
        className="dock-item dock-settings"
        aria-label="Settings"
        title="Settings (Ctrl+,)"
        onClick={onSettings}
      >
        <GearIcon />
      </button>
    </nav>
  )
}
