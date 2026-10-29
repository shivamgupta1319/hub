import { MenuIcon } from './icons'

interface Props {
  /** The open site's name, or undefined on the dashboard. */
  siteName: string | undefined
}

/**
 * Hub's own title bar: dark like the sidebar, holds the menu button, and leaves room on the right
 * for the system's minimise / maximise / close buttons. Dragging it moves the window.
 */
export function TitleBar({ siteName }: Props): React.JSX.Element {
  return (
    <header className="titlebar">
      <button
        type="button"
        className="titlebar-menu"
        aria-label="Menu"
        aria-haspopup="menu"
        title="Menu (Alt)"
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect()
          void window.hub.showAppMenu({ x: box.left, y: box.bottom })
        }}
      >
        <MenuIcon />
      </button>
      <p className="titlebar-title">
        {siteName ? (
          <>
            <span className="titlebar-site">{siteName}</span>
            <span className="titlebar-app"> — Hub</span>
          </>
        ) : (
          'Hub'
        )}
      </p>
    </header>
  )
}
