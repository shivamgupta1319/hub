import { useId, useMemo, useState } from 'react'
import { rankSites } from '@shared/search'
import { displayHost, type Site } from '@shared/site'
import { Dialog } from './Dialog'
import { SiteAvatar } from './SiteAvatar'

interface Props {
  sites: Site[]
  onClose: () => void
}

/** Ctrl+Shift+K: type to filter, arrows to move, Enter to open. */
export function QuickSwitcher({ sites, onClose }: Props): React.JSX.Element {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const results = useMemo(() => rankSites(sites, query), [sites, query])
  const listId = useId()
  const optionId = (i: number): string => `${listId}-${i}`
  const selected = Math.min(cursor, Math.max(0, results.length - 1))

  function open(site: Site | undefined): void {
    if (!site) return
    onClose()
    void window.hub.view.open(site.id)
  }

  function onKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setCursor((selected + step + results.length) % Math.max(1, results.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      open(results[selected])
    }
  }

  return (
    <Dialog title="Go to site" onClose={onClose}>
      <input
        className="field switcher-input"
        role="combobox"
        aria-label="Site name or address"
        aria-expanded="true"
        aria-controls={listId}
        aria-activedescendant={results.length ? optionId(selected) : undefined}
        placeholder="Type a site name"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setCursor(0)
        }}
        onKeyDown={onKeyDown}
        autoFocus
      />
      {results.length === 0 ? (
        <p className="switcher-empty">
          {sites.length === 0 ? 'You haven’t added any sites yet.' : `No site matches “${query}”.`}
        </p>
      ) : (
        <ul id={listId} role="listbox" className="switcher-list" aria-label="Sites">
          {results.map((site, i) => (
            <li
              key={site.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === selected}
              className="switcher-option"
              onMouseMove={() => setCursor(i)}
              onClick={() => open(site)}
            >
              <SiteAvatar site={site} size={28} />
              <span className="switcher-name">{site.name}</span>
              <span className="switcher-host">{displayHost(site.url)}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
