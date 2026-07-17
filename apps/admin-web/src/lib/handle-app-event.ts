import {
  ClaimEventType,
  ClaimKind,
  ResourceChangedKey,
  ResourceEventType,
  invalidateDashboardSummary,
  queryKeyPrefixesForResourceChanged,
  type AppEvent,
  type ClaimAppEvent,
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

/** Parses SSE `data` JSON into a typed AppEvent. Returns null for unknown or malformed payloads. */
export function parseAppEventFromSseData(data: string): AppEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(data) as unknown
  } catch {
    return null
  }

  if (isResourceChangedAppEvent(parsed) || isClaimAppEvent(parsed)) {
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

  // A claim was created/updated/deleted in internal-web. The admin home
  // dashboard's global claim counts are the only claim-derived view admin
  // renders, so a claim event just refreshes those counts.
  void invalidateDashboardSummary(queryClient)
}
