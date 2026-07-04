import { attachmentKeys, ClaimEventType, ClaimKind, type ClaimEventPayload } from '@mr/shared'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

const SSE_URL = '/api/events/me'
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

const CLAIM_EVENT_TYPES = [
  ClaimEventType.Created,
  ClaimEventType.Updated,
  ClaimEventType.Deleted,
] as const

function isClaimKind(value: unknown): value is ClaimKind {
  return typeof value === 'string' && (Object.values(ClaimKind) as string[]).includes(value)
}

/** Parses SSE `data` JSON into a claim event payload; null for anything else. */
function parseClaimEventPayload(data: string): ClaimEventPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(data) as unknown
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || !('payload' in parsed)) {
    return null
  }
  const payload = (parsed as { payload: unknown }).payload
  if (typeof payload !== 'object' || payload === null) {
    return null
  }
  const { kind, id } = payload as { kind?: unknown; id?: unknown }
  if (!isClaimKind(kind) || typeof id !== 'string') {
    return null
  }
  return { kind, id }
}

/** Signal-only invalidation, mirroring the internal app: never patches caches. */
function invalidateForClaimEvent(queryClient: QueryClient, payload: ClaimEventPayload): void {
  void queryClient.invalidateQueries({ queryKey: ['claims', 'client-list'] })
  void queryClient.invalidateQueries({ queryKey: ['dashboard', 'client-summary'] })
  void queryClient.invalidateQueries({ queryKey: ['emotive-claims', 'client-detail', payload.id] })
  void queryClient.invalidateQueries({ queryKey: attachmentKeys.list(payload.kind, payload.id) })
}

/**
 * Portal realtime: one EventSource per authenticated session. The server routes
 * claim signals through the client's OWN customer channels (`customer:<id>`),
 * so an outcome change or a new workshop photo shows up the moment the
 * operator saves it — event-driven, no polling. Events carry `kind + id` only.
 */
export function usePortalEventStream(): void {
  const queryClient = useQueryClient()
  const queryClientRef = useRef(queryClient)
  queryClientRef.current = queryClient

  useEffect(() => {
    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined
    let backoffMs = INITIAL_BACKOFF_MS
    let disposed = false

    const scheduleReconnect = (): void => {
      if (disposed) {
        return
      }
      reconnectTimer = setTimeout(() => {
        connect()
      }, backoffMs)
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
    }

    const onClaimEvent = (message: MessageEvent<string>): void => {
      const payload = parseClaimEventPayload(message.data)
      if (payload !== null) {
        invalidateForClaimEvent(queryClientRef.current, payload)
      }
    }

    const connect = (): void => {
      if (disposed) {
        return
      }

      es?.close()
      es = new EventSource(SSE_URL)

      es.addEventListener('open', () => {
        backoffMs = INITIAL_BACKOFF_MS
      })

      for (const type of CLAIM_EVENT_TYPES) {
        es.addEventListener(type, onClaimEvent)
      }

      es.onerror = () => {
        es?.close()
        es = null
        scheduleReconnect()
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer)
      }
      es?.close()
      es = null
    }
  }, [])
}
