import type { PresenceTarget, PresenceViewer } from '@mr/shared'

import { ClaimPresenceStore } from './presence.store.js'

function claimKey(target: PresenceTarget): string {
  return `${target.kind}:${target.id}`
}

/**
 * Thin wrapper over the in-memory presence store. The only rule it adds is that a
 * heartbeat's answer excludes the caller — you never need to be told you are here.
 */
export class PresenceService {
  constructor(private readonly store: ClaimPresenceStore) {}

  heartbeat(target: PresenceTarget, viewer: PresenceViewer): PresenceViewer[] {
    const present = this.store.heartbeat(claimKey(target), viewer)
    return present.filter((entry) => entry.userId !== viewer.userId)
  }

  leave(target: PresenceTarget, userId: string): void {
    this.store.leave(claimKey(target), userId)
  }
}
