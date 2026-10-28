import { HomeIcon } from './icons'

export function Sidebar(): React.JSX.Element {
  return (
    <nav className="sidebar" aria-label="Sites">
      <button
        type="button"
        className="dock-item is-active"
        aria-label="All sites"
        aria-current="page"
        title="All sites"
      >
        <HomeIcon />
      </button>
      <div className="dock-divider" role="separator" />
      <ul className="dock-list" />
    </nav>
  )
}
