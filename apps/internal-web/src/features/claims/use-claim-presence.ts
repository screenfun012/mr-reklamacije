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
 *
 * A HIDDEN tab does not beat at all. Every beat costs a session validation on the API (three
 * queries, docs/22), and a workshop machine with four claims parked in background tabs was
 * paying for four of them every 15 seconds to answer a question nobody was looking at. Going
 * hidden leaves; coming back beats at once, so the cue is accurate the moment it is on screen.
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
      if (document.hidden) {
        return
      }
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

    const onVisibility = (): void => {
      if (document.hidden) {
        // Nobody is looking any more; say so instead of waiting out the stale timeout.
        setOthers([])
        leave()
        return
      }
      beat()
    }

    // `pagehide` fires on tab close and bfcache navigation, where unmount may not.
    window.addEventListener('pagehide', leave)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('pagehide', leave)
      document.removeEventListener('visibilitychange', onVisibility)
      leave()
    }
  }, [kind, id])

  return others
}
