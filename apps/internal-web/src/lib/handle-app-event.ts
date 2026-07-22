import {
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

/**
 * Parses SSE `data` JSON into a typed AppEvent. Returns null for unknown or malformed payloads.
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
    isNotificationAppEvent(parsed)
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
    return
  }

  // Something landed in this user's inbox — refresh the bell count and the list.
  // The event carries only an id; the text is never on the wire.
  if (event.type === NotificationEventType.Created) {
    void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() })
    return
  }

  // A claim was created/updated/deleted by another user — refresh the same
  // views the acting user's mutation invalidated so open lists/detail/stats
  // stay live across users.
  invalidateInternalClaimQueries(queryClient, event.payload)
}
