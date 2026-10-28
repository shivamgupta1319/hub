import { useCallback, useEffect, useState } from 'react'
import type { Site } from '@shared/site'

export type SitesState =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; sites: Site[] }

/** Loads the site list and keeps it in sync with changes made anywhere in the app. */
export function useSites(): { state: SitesState; reload: () => void } {
  const [state, setState] = useState<SitesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    window.hub.sites
      .list()
      .then((sites) => live && setState({ status: 'ready', sites }))
      .catch((err: unknown) => {
        if (!live) return
        const message = err instanceof Error ? err.message : String(err)
        setState({ status: 'error', message })
      })
    const off = window.hub.sites.onChanged((sites) => setState({ status: 'ready', sites }))
    return () => {
      live = false
      off()
    }
  }, [attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  return { state, reload }
}
