import {
  ClaimKind,
  PRESENCE_HEARTBEAT_MS,
  sendPresenceHeartbeat,
  sendPresenceLeave,
  type PresenceViewer,
} from '@mr/shared'
import { useEffect, useState } from 'react'

/**
 * Announces that this operator is viewing a claim, and reports who else is.
 *
 * A plain heartbeat, not SSE: the client POSTs every PRESENCE_HEARTBEAT_MS and the
 * response carries the other viewers. A "someone else is here" cue tolerates a
 * few seconds of latency, so this adds no new realtime machinery — see
 * docs/22 (presence) and presence.store.ts for the single-replica caveat.
 *
 * Leaves on unmount and on the tab being hidden/closed (`pagehide`), so a viewer
 * who navigates away or shuts the laptop stops showing almost at once rather than
 * lingering until the server's stale timeout.
 */
export function useClaimPresence(kind: ClaimKind, id: string): PresenceViewer[] {
  const [others, setOthers] = useState<PresenceViewer[]>([])

  useEffect(() => {
    const target = { kind, id }
    let cancelled = false

    // Clear any prior claim's viewers immediately: a ⌘K jump from A to B reuses
    // this component instance, so without this the bar would flash A's viewers on
    // B until B's first heartbeat answers. Default to "nobody else" until proven.
    setOthers([])

    const beat = (): void => {
      void sendPresenceHeartbeat(target)
        .then((response) => {
          if (!cancelled) {
            setOthers(response.viewers)
          }
        })
        // A missed heartbeat is not worth surfacing — the next one recovers, and a
        // 401/redirect is handled globally. Presence must never break the page.
        .catch(() => undefined)
    }

    beat()
    const interval = window.setInterval(beat, PRESENCE_HEARTBEAT_MS)

    const leave = (): void => {
      void sendPresenceLeave(target).catch(() => undefined)
    }
    // `pagehide` fires on tab close and bfcache navigation, where unmount may not.
    window.addEventListener('pagehide', leave)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('pagehide', leave)
      leave()
    }
  }, [kind, id])

  return others
}
