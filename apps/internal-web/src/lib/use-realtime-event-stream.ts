import { ResourceEventType } from '@mr/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { authClient } from './auth-client'
import { handleAppEvent, parseAppEventFromSseData } from './handle-app-event'

const SSE_URL = '/api/events/me'
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

/**
 * Keeps a single EventSource open while the user is authenticated and invalidates
 * TanStack Query caches on server push events (cross-tab / cross-app catalog sync).
 */
export function useRealtimeEventStream(): void {
  const queryClient = useQueryClient()
  const { data: session } = authClient.useSession()
  const isAuthenticated = session?.user !== undefined
  const queryClientRef = useRef(queryClient)
  queryClientRef.current = queryClient

  useEffect(() => {
    if (!isAuthenticated) {
      return
    }

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

    const onResourceChanged = (message: MessageEvent<string>): void => {
      const event = parseAppEventFromSseData(message.data)
      if (event !== null) {
        handleAppEvent(queryClientRef.current, event)
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

      es.addEventListener(ResourceEventType.Changed, onResourceChanged)

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
  }, [isAuthenticated])
}
