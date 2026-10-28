import { useEffect, useState } from 'react'
import type { ViewStatus } from '@shared/ipc'

/** Which site page is on screen (null = dashboard) and the latest load state of each page. */
export function useActiveSite(): {
  activeId: string | null
  statuses: ReadonlyMap<string, ViewStatus>
} {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<ReadonlyMap<string, ViewStatus>>(new Map())

  useEffect(() => {
    const offActive = window.hub.view.onActive(setActiveId)
    const offStatus = window.hub.view.onStatus((status) =>
      setStatuses((prev) => new Map(prev).set(status.id, status))
    )
    return () => {
      offActive()
      offStatus()
    }
  }, [])

  return { activeId, statuses }
}
