import { useEffect, useState } from 'react'
import type { Badge } from '@shared/badges'
import type { ViewStatus } from '@shared/ipc'

/** Which site page is on screen (null = dashboard), each page's load state and unread badge. */
export function useActiveSite(): {
  activeId: string | null
  statuses: ReadonlyMap<string, ViewStatus>
  badges: ReadonlyMap<string, Badge>
} {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [statuses, setStatuses] = useState<ReadonlyMap<string, ViewStatus>>(new Map())
  const [badges, setBadges] = useState<ReadonlyMap<string, Badge>>(new Map())

  useEffect(() => {
    const offActive = window.hub.view.onActive(setActiveId)
    const offStatus = window.hub.view.onStatus((status) =>
      setStatuses((prev) => new Map(prev).set(status.id, status))
    )
    const offBadge = window.hub.view.onBadge((id, badge) =>
      setBadges((prev) => new Map(prev).set(id, badge))
    )
    return () => {
      offActive()
      offStatus()
      offBadge()
    }
  }, [])

  return { activeId, statuses, badges }
}
