export interface PresenceViewer {
  userId: string
  name: string
}

interface Entry extends PresenceViewer {
  lastSeen: number
}

/**
 * Who is looking at which claim, right now. Deliberately in-memory and ephemeral:
 * presence is worthless the moment it is stale, so it is never persisted — a
 * restart simply repopulates from the next heartbeat.
 *
 * ⚠️ SINGLE-REPLICA ONLY. This lives in one process's heap, so with more than one
 * API replica each replica would see only the viewers connected to it, and two
 * people on different replicas would not see each other. That is a known,
 * accepted limit today (`numReplicas` is 1). If we ever run multiple replicas,
 * presence must be broadcast over the same Postgres LISTEN/NOTIFY channel the SSE
 * bus already uses — see docs/22 §4. Do not chase "presence is missing people" as
 * a bug before checking the replica count.
 *
 * Stale entries are pruned lazily, on every access. A claim nobody revisits keeps
 * a few dead entries until the next restart — negligible at this scale; add a
 * sweep only if that ever stops being true.
 */
export class ClaimPresenceStore {
  private readonly byClaim = new Map<string, Map<string, Entry>>()

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly staleMs: number = 40_000,
  ) {}

  /** Records that `viewer` is on `claimKey` now; returns everyone currently present (self included). */
  heartbeat(claimKey: string, viewer: PresenceViewer): PresenceViewer[] {
    const viewers = this.byClaim.get(claimKey) ?? new Map<string, Entry>()
    viewers.set(viewer.userId, { ...viewer, lastSeen: this.now() })
    this.byClaim.set(claimKey, viewers)
    return this.prunedViewers(claimKey)
  }

  /** Removes `userId` from `claimKey` (an explicit close, before the stale timeout). */
  leave(claimKey: string, userId: string): void {
    const viewers = this.byClaim.get(claimKey)
    if (viewers === undefined) {
      return
    }
    viewers.delete(userId)
    if (viewers.size === 0) {
      this.byClaim.delete(claimKey)
    }
  }

  /** Everyone currently present on `claimKey`, stale entries dropped. */
  viewers(claimKey: string): PresenceViewer[] {
    return this.prunedViewers(claimKey)
  }

  private prunedViewers(claimKey: string): PresenceViewer[] {
    const viewers = this.byClaim.get(claimKey)
    if (viewers === undefined) {
      return []
    }

    const cutoff = this.now() - this.staleMs
    for (const [userId, entry] of viewers) {
      if (entry.lastSeen < cutoff) {
        viewers.delete(userId)
      }
    }
    if (viewers.size === 0) {
      this.byClaim.delete(claimKey)
      return []
    }

    return [...viewers.values()].map(({ userId, name }) => ({ userId, name }))
  }
}
