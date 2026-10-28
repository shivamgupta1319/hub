import type { ViewStatus } from '@shared/ipc'
import type { Site } from '@shared/site'
import { HomeIcon } from './icons'
import { SiteAvatar } from './SiteAvatar'

interface Props {
  sites: Site[]
  activeId: string | null
  statuses: ReadonlyMap<string, ViewStatus>
}

export function Sidebar({ sites, activeId, statuses }: Props): React.JSX.Element {
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
          return (
            <li key={site.id}>
              <button
                type="button"
                className={`dock-item${active ? ' is-active' : ''}${asleep ? ' is-asleep' : ''}`}
                aria-label={
                  broken
                    ? `${site.name} (didn’t load)`
                    : asleep
                      ? `${site.name} (asleep)`
                      : site.name
                }
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
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
