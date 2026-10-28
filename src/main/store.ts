import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  defaultName,
  NAME_MAX,
  normalizeUrl,
  sitesFileSchema,
  type NewSite,
  type Result,
  type Site,
  type SitePatch
} from '@shared/site'

/** Saved sites in one JSON file. Writes go through a temp file so a crash can't truncate it. */
export class SiteStore {
  private sites: Site[] = []

  constructor(
    private readonly filePath: string,
    private readonly now: () => number = Date.now
  ) {
    this.load()
  }

  list(): Site[] {
    return this.sites.map((s) => ({ ...s }))
  }

  get(id: string): Site | undefined {
    const site = this.sites.find((s) => s.id === id)
    return site && { ...site }
  }

  add(input: NewSite): Result<Site> {
    const url = normalizeUrl(input.url)
    if (!url.ok) return url
    const name = cleanName(input.name) ?? defaultName(url.value)
    const site: Site = {
      id: randomUUID(),
      name,
      url: url.value,
      keepAlive: false,
      notifications: true,
      createdAt: this.now()
    }
    this.sites.push(site)
    this.save()
    return { ok: true, value: { ...site } }
  }

  update(id: string, patch: SitePatch): Result<Site> {
    const site = this.sites.find((s) => s.id === id)
    if (!site) return { ok: false, error: 'That site no longer exists.' }

    const next: Site = { ...site }
    if (patch.url !== undefined) {
      const url = normalizeUrl(patch.url)
      if (!url.ok) return url
      next.url = url.value
    }
    if (patch.name !== undefined) {
      const name = cleanName(patch.name)
      if (!name) return { ok: false, error: 'Give the site a name.' }
      next.name = name
    }
    if (patch.keepAlive !== undefined) next.keepAlive = patch.keepAlive
    if (patch.notifications !== undefined) next.notifications = patch.notifications

    Object.assign(site, next)
    this.save()
    return { ok: true, value: { ...site } }
  }

  /** Sets a site's cached icon. Returns false when nothing changed. */
  setIcon(id: string, iconDataUrl: string): boolean {
    const site = this.sites.find((s) => s.id === id)
    if (!site || site.iconDataUrl === iconDataUrl) return false
    site.iconDataUrl = iconDataUrl
    this.save()
    return true
  }

  remove(id: string): boolean {
    const before = this.sites.length
    this.sites = this.sites.filter((s) => s.id !== id)
    if (this.sites.length === before) return false
    this.save()
    return true
  }

  /** Reorders to match `ids`. Unknown ids are ignored; sites missing from `ids` keep their relative order at the end. */
  reorder(ids: readonly string[]): void {
    const rank = new Map(ids.map((id, i) => [id, i]))
    const at = (s: Site): number => rank.get(s.id) ?? Number.MAX_SAFE_INTEGER
    this.sites = this.sites
      .map((s, i) => ({ s, i }))
      .sort((a, b) => at(a.s) - at(b.s) || a.i - b.i)
      .map(({ s }) => s)
    this.save()
  }

  private load(): void {
    if (!existsSync(this.filePath)) return
    try {
      const parsed = sitesFileSchema.parse(JSON.parse(readFileSync(this.filePath, 'utf8')))
      this.sites = parsed.sites
    } catch (err) {
      // Keep the unreadable file for recovery instead of overwriting it on the next save.
      const backup = `${this.filePath}.corrupt-${this.now()}`
      renameSync(this.filePath, backup)
      console.error(`sites file was unreadable; moved to ${backup}`, err)
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify({ version: 1, sites: this.sites }, null, 2))
    renameSync(tmp, this.filePath)
  }
}

function cleanName(name: string): string | undefined {
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
  return trimmed || undefined
}
