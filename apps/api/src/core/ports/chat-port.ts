import type { ChatSystemKind, ClaimKind } from '@mr/shared'

/** Which claim's thread the event belongs to. The two families share no id space. */
export interface ChatSystemMessageTarget {
  readonly kind: ClaimKind
  readonly claimId: string
}

/**
 * The slice of the chat other domain modules call to record what the shop did. A core port so
 * those modules depend on core, not a sibling module (depcruise `no-sibling-modules`); the
 * container injects the concrete `ChatService`.
 *
 * Best-effort and NEVER rejects — a claim's outcome is not undone because a note about it could
 * not be written. Same rule as `fanOut()` in the notifications service.
 */
export interface ChatPort {
  /**
   * ⚠ It NEVER creates a thread. A claim with no thread means nobody opened one, and spec §5 row 9
   * is explicit that nothing is made silently — so the event is dropped, deliberately. The thread
   * is opened by a person, through `POST /api/chat/claims/:kind/:id/thread`.
   */
  postSystemMessage(
    target: ChatSystemMessageTarget,
    systemKind: ChatSystemKind,
    meta: Record<string, string>,
  ): Promise<void>
}
