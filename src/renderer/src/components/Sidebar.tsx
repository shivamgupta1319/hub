import { badgeLabel, type Badge } from '@shared/badges'
import type { ViewStatus } from '@shared/ipc'
import type { Site } from '@shared/site'
import { HomeIcon } from './icons'
import { SiteAvatar } from './SiteAvatar'

interface Props {
  sites: Site[]
  activeId: string | null
  statuses: ReadonlyMap<string, ViewStatus>
  badges: ReadonlyMap<string, Badge>
}

function describe(site: Site, state: ViewStatus['state'] | undefined, badge: Badge): string {
  if (state === 'error' || state === 'crashed') return `${site.name} (didn’t load)`
  if (state === 'sleeping') return `${site.name} (asleep)`
  if (typeof badge === 'number') return `${site.name}, ${badge} unread`
  if (badge === 'dot') return `${site.name}, new activity`
  return site.name
}

export function Sidebar({ sites, activeId, statuses, badges }: Props): React.JSX.Element {
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
        {sites.map((site) => {
          const state = statuses.get(site.id)?.state
          const active = site.id === activeId
          const broken = state === 'error' || state === 'crashed'
          const asleep = state === 'sleeping'
          const badge = badges.get(site.id) ?? null
          return (
            <li key={site.id}>
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
    </nav>
  )
}
