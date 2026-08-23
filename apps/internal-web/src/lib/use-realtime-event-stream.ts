import {
  ChatEventType,
  ClaimEventType,
  ClientSubmissionEventType,
  ResourceEventType,
  SSE_PING_EVENT,
} from '@mr/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { authClient } from './auth-client'
import { handleAppEvent, parseAppEventFromSseData } from './handle-app-event'

const SSE_URL = '/api/events/me'
const INITIAL_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

/**
 * How long the stream may stay completely silent before we assume it is dead.
 *
 * The server sends a named `ping` every 20 s, so 45 s allows one to be lost without a false alarm.
 * It exists because a half-open connection announces nothing: when TCP dies without an RST — a
 * phone moving from Wi-Fi to mobile, a VPN dropping, a laptop waking — `onerror` never fires and
 * `EventSource` sits there believing it is connected. That is the "it stopped updating, a refresh
 * fixed it" bug, and at phone scale it is not an edge case.
 */
const SILENCE_TIMEOUT_MS = 45_000

/**
 * Fired on `window` whenever this stream (re)connects, and whenever the watchdog above decides it
 * was dead. It is a plain DOM event on purpose: the one thing a listener needs to know is "the
 * pipe was interrupted, ask the server what you missed" — no payload, no store, no context.
 *
 * ⚠ A dispatch also happens when the watchdog fires, BEFORE the socket is back. That is
 * deliberate: recovery is an ordinary HTTP read and works while SSE is still broken, which is
 * exactly the moment there is something to recover.
 */
export const REALTIME_STREAM_OPEN_EVENT = 'mrr:realtime-open'

// Every named SSE event the internal app reacts to: catalog sync + claim
// lifecycle (so open lists/detail/stats live-update across users) + client
// submissions (so the Pristiglo Inbox list & nav badge stay live).
const HANDLED_EVENT_TYPES = [
  ResourceEventType.Changed,
  ClaimEventType.Created,
  ClaimEventType.Updated,
  ClaimEventType.Deleted,
  ClientSubmissionEventType.Changed,
  ChatEventType.MessageCreated,
] as const

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
    let lastEventAt = Date.now()
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

    /** Anything arriving proves the pipe is alive — a real event or the server's own pulse. */
    const markAlive = (): void => {
      lastEventAt = Date.now()
    }

    const onAppEvent = (message: MessageEvent<string>): void => {
      markAlive()
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
        markAlive()
        window.dispatchEvent(new Event(REALTIME_STREAM_OPEN_EVENT))
      })

      // Carries no data; its arrival is the whole message.
      es.addEventListener(SSE_PING_EVENT, markAlive)

      for (const type of HANDLED_EVENT_TYPES) {
        es.addEventListener(type, onAppEvent)
      }

      es.onerror = () => {
        es?.close()
        es = null
        scheduleReconnect()
      }
    }

    connect()

    const silenceTimer = setInterval(() => {
      if (disposed || Date.now() - lastEventAt < SILENCE_TIMEOUT_MS) {
        return
      }
      // Nothing at all for 45 s. Do not wait for an error that will never come.
      es?.close()
      es = null
      markAlive()
      window.dispatchEvent(new Event(REALTIME_STREAM_OPEN_EVENT))
      connect()
    }, SILENCE_TIMEOUT_MS)

    return () => {
      disposed = true
      clearInterval(silenceTimer)
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer)
      }
      es?.close()
      es = null
    }
  }, [isAuthenticated])
}
