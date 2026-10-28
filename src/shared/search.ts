import { displayHost, type Site } from './site'

/**
 * Filters sites for the quick switcher. Name prefixes rank first, then word starts, then
 * matches anywhere in the name or address; ties keep the sidebar order.
 */
export function rankSites(sites: readonly Site[], query: string): Site[] {
  const q = query.trim().toLowerCase()
  if (!q) return [...sites]
  const score = (site: Site): number => {
    const name = site.name.toLowerCase()
    if (name.startsWith(q)) return 0
    if (name.split(/\s+/).some((w) => w.startsWith(q))) return 1
    if (name.includes(q)) return 2
    if (displayHost(site.url).includes(q)) return 3
    return -1
  }
  return sites
    .map((site, i) => ({ site, i, s: score(site) }))
    .filter((r) => r.s >= 0)
    .sort((a, b) => a.s - b.s || a.i - b.i)
    .map((r) => r.site)
}
