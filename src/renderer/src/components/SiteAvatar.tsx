import type { Site } from '@shared/site'

// Muted tones so letter avatars sit quietly next to real favicons.
const TONES = [
  '#3f6f8f',
  '#6b5b95',
  '#2f7d62',
  '#9a5b3c',
  '#7a6a2f',
  '#8a4563',
  '#4d6a3a',
  '#505a9a'
]

function tone(name: string): string {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length] ?? '#3f6f8f'
}

interface Props {
  site: Pick<Site, 'name' | 'iconDataUrl'>
  size: number
}

export function SiteAvatar({ site, size }: Props): React.JSX.Element {
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.24) }
  if (site.iconDataUrl) {
    return (
      <span className="avatar avatar-icon" style={style}>
        <img src={site.iconDataUrl} alt="" width={size * 0.62} height={size * 0.62} />
      </span>
    )
  }
  return (
    <span
      className="avatar avatar-letter"
      style={{ ...style, background: tone(site.name), fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {site.name.charAt(0).toUpperCase()}
    </span>
  )
}
