import {
  chatKeys,
  ChatEventType,
  ClaimEventType,
  ClaimKind,
  ClientSubmissionEventType,
  invalidateInternalClaimQueries,
  invalidateInternalSubmissionQueries,
  NotificationEventType,
  notificationKeys,
  queryKeyPrefixesForResourceChanged,
  ResourceChangedKey,
  ResourceEventType,
  type AppEvent,
  type ChatAppEvent,
  type ClaimAppEvent,
  type ClientSubmissionAppEvent,
  type NotificationAppEvent,
  type ResourceChangedAppEvent,
} from '@mr/shared'
import type { QueryClient } from '@tanstack/react-query'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isResourceChangedKey(value: unknown): value is ResourceChangedKey {
  return (
    typeof value === 'string' && (Object.values(ResourceChangedKey) as string[]).includes(value)
  )
}

function isResourceChangedAppEvent(value: unknown): value is ResourceChangedAppEvent {
  if (
    !isRecord(value) ||
    value['type'] !== ResourceEventType.Changed ||
    !isRecord(value['payload'])
  ) {
    return false
  }
  return isResourceChangedKey(value['payload']['resource'])
}

function isClaimKind(value: unknown): value is ClaimKind {
  return typeof value === 'string' && (Object.values(ClaimKind) as string[]).includes(value)
}

function isClaimAppEvent(value: unknown): value is ClaimAppEvent {
  if (!isRecord(value) || !isRecord(value['payload'])) {
    return false
  }
  const isClaimType = (Object.values(ClaimEventType) as string[]).includes(value['type'] as string)
  return (
    isClaimType &&
    isClaimKind(value['payload']['kind']) &&
    typeof value['payload']['id'] === 'string'
  )
}

function isClientSubmissionAppEvent(value: unknown): value is ClientSubmissionAppEvent {
  return (
    isRecord(value) &&
    value['type'] === ClientSubmissionEventType.Changed &&
    isRecord(value['payload']) &&
    typeof value['payload']['id'] === 'string'
  )
}

function isNotificationAppEvent(value: unknown): value is NotificationAppEvent {
  return (
    isRecord(value) &&
    value['type'] === NotificationEventType.Created &&
    isRecord(value['payload']) &&
    typeof value['payload']['id'] === 'string'
  )
}

function isChatAppEvent(value: unknown): value is ChatAppEvent {
  return (
    isRecord(value) &&
    value['type'] === ChatEventType.MessageCreated &&
    isRecord(value['payload']) &&
    typeof value['payload']['conversationId'] === 'string' &&
    typeof value['payload']['messageId'] === 'string'
  )
}

/**
 * Parses SSE `data` JSON into a typed AppEvent. Returns null for unknown or malformed payloads.
 *
 * ⚠ A type missing from this list is dropped in SILENCE — the server publishes, the stream
 * delivers, and the screen never learns. Every new event kind ends here as well as in the bus.
 */
export function parseAppEventFromSseData(data: string): AppEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(data) as unknown
  } catch {
    return null
  }

  if (
    isResourceChangedAppEvent(parsed) ||
    isClaimAppEvent(parsed) ||
    isClientSubmissionAppEvent(parsed) ||
    isNotificationAppEvent(parsed) ||
    isChatAppEvent(parsed)
  ) {
    return parsed
  }

  return null
}

/** Maps a server SSE event to TanStack Query invalidations (signal-only, no cache patching). */
export function handleAppEvent(queryClient: QueryClient, event: AppEvent): void {
  if (event.type === ResourceEventType.Changed) {
    for (const prefix of queryKeyPrefixesForResourceChanged(event.payload.resource)) {
      void queryClient.invalidateQueries({ queryKey: prefix })
    }
    return
  }

  // A client submission was created/converted/rejected by another user — refresh the Inbox
  // list (every page), the nav-badge count and the changed submission's detail.
  if (event.type === ClientSubmissionEventType.Changed) {
    invalidateInternalSubmissionQueries(queryClient, event.payload.id)
    // Handling a submission also rewrites its notifications (new_submission →
    // claim_created / submission_rejected), so refresh the bell too.
    void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
    return
  }

  // Something landed in this user's inbox — refresh the bell count and the list.
  // The event carries only an id; the text is never on the wire.
  if (event.type === NotificationEventType.Created) {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
    return
  }

  /**
   * Something happened in a room. The signal carries only ids — never the text (CLAUDE.md §2) — so
   * the conversation list refreshes for its unread count, and the open conversation refetches from
   * where it left off.
   *
   * ⚠ The shortlist too. The same signal is published by a pin and by a like, and without this
   * line somebody else's pin left MY pinned bar showing yesterday's message — the mutation
   * invalidates only for the person who made it. Found in the browser with two accounts side by
   * side, 2026-08-24, which is the only place it could be found.
   */
  if (event.type === ChatEventType.MessageCreated) {
    void queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
    void queryClient.invalidateQueries({
      queryKey: chatKeys.messages(event.payload.conversationId),
    })
    void queryClient.invalidateQueries({ queryKey: chatKeys.pins(event.payload.conversationId) })
    // The shelf is its own request, so it has to be told too — a photo somebody else sent would
    // otherwise sit in the room while the panel beside it still says nine.
    void queryClient.invalidateQueries({
      queryKey: chatKeys.attachments(event.payload.conversationId),
    })
    return
  }

  // A claim was created/updated/deleted by another user — refresh the same
  // views the acting user's mutation invalidated so open lists/detail/stats
  // stay live across users.
  invalidateInternalClaimQueries(queryClient, event.payload)
}
