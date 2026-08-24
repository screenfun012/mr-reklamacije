/** What a phone is told, once the fan-out has decided it should be told anything at all. */
export interface ChatPushMessage {
  readonly conversationId: string
  /** The channel's name or the thread's MR number. */
  readonly conversationTitle: string
  readonly authorName: string
  /** The first words, already stripped of mention markup. */
  readonly excerpt: string
  /** Everybody this message names, so the `mentions` position knows whether to fire. */
  readonly mentionedUserIds: readonly string[]
  /** Everybody who may see the room, author excluded — resolved by the chat module. */
  readonly recipientIds: readonly string[]
}

/**
 * Telling a phone. A core port so the chat module depends on core rather than a sibling module
 * (depcruise `no-sibling-modules`); the container injects the concrete service.
 *
 * ⚠ Best-effort and NEVER rejects — a notification is not worth failing the message it describes.
 * The caller still writes `.catch()` anyway: Node 24 throws on an unhandled rejection and this API
 * registers no handler for it, so "never rejects" must not be the only thing standing between one
 * push service having a bad day and the whole service going down.
 */
export interface PushPort {
  /** Whether push is configured at all. False when the VAPID keys are absent. */
  readonly isEnabled: boolean

  notifyChatMessage(message: ChatPushMessage): Promise<void>
}
