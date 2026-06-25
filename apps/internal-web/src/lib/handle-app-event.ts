import {
  ResourceChangedKey,
  ResourceEventType,
  queryKeyPrefixesForResourceChanged,
  type AppEvent,
  type ResourceChangedAppEvent,
} from '@mr/shared'
import type { QueryClient } from '@tanstack/react-query'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isResourceChangedKey(value: unknown): value is ResourceChangedKey {
  return value === ResourceChangedKey.Customers || value === ResourceChangedKey.EngineTypes
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

  if (isResourceChangedAppEvent(parsed)) {
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
  }
}
