import type { ViewStatus } from '@shared/ipc'
import type { Site } from '@shared/site'
import { SiteAvatar } from './SiteAvatar'

interface Props {
  site: Site
  status: ViewStatus | undefined
  onEdit: () => void
}

/**
 * Sits underneath the site's page. Normally the page covers it; it only shows when the page
 * failed to load or crashed (main hides the page then), or before the page first paints.
 */
export function SiteStage({ site, status, onEdit }: Props): React.JSX.Element {
  const state = status?.state ?? 'loading'

  if (state === 'error' || state === 'crashed') {
    return (
      <section className="stage stage-problem" role="alert" aria-labelledby="stage-title">
        <SiteAvatar site={site} size={56} />
        <h1 id="stage-title">
          {state === 'crashed' ? `${site.name} stopped working` : `${site.name} didn’t load`}
        </h1>
        <p>
          {state === 'crashed'
            ? 'The page crashed. Reloading usually fixes it.'
            : (status?.message ?? 'The page couldn’t load.')}
        </p>
        <div className="stage-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void window.hub.view.reload(site.id)}
          >
            {state === 'crashed' ? 'Reload' : 'Try again'}
          </button>
          <button type="button" className="btn" onClick={onEdit}>
            Edit address
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="stage" aria-busy="true" aria-label={`Opening ${site.name}`}>
      <SiteAvatar site={site} size={56} />
      <p className="stage-loading">Opening {site.name}…</p>
    </section>
  )
}
