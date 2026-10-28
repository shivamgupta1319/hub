import { displayHost, type Site } from '@shared/site'
import type { SitesState } from '../hooks/useSites'
import { AddSiteBar } from './AddSiteBar'
import { PencilIcon } from './icons'
import { SiteAvatar } from './SiteAvatar'

const SUGGESTIONS = [
  { name: 'Gmail', url: 'https://mail.google.com/' },
  { name: 'Calendar', url: 'https://calendar.google.com/' },
  { name: 'WhatsApp', url: 'https://web.whatsapp.com/' },
  { name: 'GitHub', url: 'https://github.com/' },
  { name: 'Slack', url: 'https://app.slack.com/' },
  { name: 'Notion', url: 'https://www.notion.so/' }
]

interface Props {
  state: SitesState
  reload: () => void
  onEdit: (site: Site) => void
  /** Announces a result to screen readers. */
  onStatus: (message: string) => void
}

export function Dashboard({ state, reload, onEdit, onStatus }: Props): React.JSX.Element {
  const sites = state.status === 'ready' ? state.sites : []
  const suggestions = SUGGESTIONS.filter(
    (s) => !sites.some((site) => displayHost(site.url) === displayHost(s.url))
  )

  async function addSuggestion(name: string, url: string): Promise<void> {
    const result = await window.hub.sites.add({ name, url })
    onStatus(result.ok ? `Added ${result.value.name}.` : result.error)
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Your sites</h1>
      </header>

      <AddSiteBar onAdded={(name) => onStatus(`Added ${name}.`)} />

      {state.status === 'loading' && (
        <ul className="site-grid" aria-label="Loading your sites" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="tile tile-skeleton">
              <span className="skeleton skeleton-avatar" />
              <span className="skeleton skeleton-line" />
            </li>
          ))}
        </ul>
      )}

      {state.status === 'error' && (
        <section className="notice" role="alert">
          <p>Hub couldn’t read your saved sites. {state.message}</p>
          <button type="button" className="btn" onClick={reload}>
            Try again
          </button>
        </section>
      )}

      {state.status === 'ready' && sites.length > 0 && (
        <ul className="site-grid" aria-label="Saved sites">
          {sites.map((site) => (
            <li key={site.id} className="tile">
              <button
                type="button"
                className="tile-main"
                title={`${site.name}\n${site.url}`}
                onClick={() => void window.hub.view.open(site.id)}
              >
                <SiteAvatar site={site} size={56} />
                <span className="tile-name">{site.name}</span>
                <span className="tile-host">{displayHost(site.url)}</span>
              </button>
              <button
                type="button"
                className="tile-edit"
                aria-label={`Edit ${site.name}`}
                title="Edit"
                onClick={() => onEdit(site)}
              >
                <PencilIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {state.status === 'ready' && sites.length === 0 && (
        <section className="empty" aria-labelledby="empty-title">
          <h2 id="empty-title">Nothing here yet</h2>
          <p>
            Add the websites you open every day, such as mail, chat or your project board. Each one
            gets an icon in the sidebar so you can switch with one click.
          </p>
        </section>
      )}

      {state.status === 'ready' && sites.length === 0 && suggestions.length > 0 && (
        <section className="suggestions" aria-labelledby="suggest-title">
          <h2 id="suggest-title" className="suggest-title">
            Or start with one of these
          </h2>
          <ul className="chip-list">
            {suggestions.map((s) => (
              <li key={s.url}>
                <button
                  type="button"
                  className="chip"
                  onClick={() => void addSuggestion(s.name, s.url)}
                >
                  <SiteAvatar site={{ name: s.name }} size={24} />
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
