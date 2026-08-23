import {
  CHAT_RECOVERY_OVERLAP,
  chatKeys,
  fetchChatMessagesSince,
  type ChatMessage,
  type ChatMessagesPage,
} from '@mr/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { REALTIME_STREAM_OPEN_EVENT } from '~/lib/use-realtime-event-stream'

/**
 * Where to start asking from.
 *
 * ⚠ `maxSeen - CHAT_RECOVERY_OVERLAP`, and this is the one number the whole design hangs on.
 * `seq` is a `bigserial`: it is handed out at INSERT and only becomes visible at COMMIT, so two
 * people sending at once can leave a reader holding 42 while 41 is still being written. Asking
 * for "> 42" would step over 41 and it would never be seen by anyone on this client again.
 * Asking for "> 22" costs twenty rows that are thrown away by id below.
 */
export function recoveryCursor(items: readonly ChatMessage[]): string {
  const maxSeen = items.reduce((max, item) => Math.max(max, Number(item.seq)), 0)
  return String(Math.max(0, maxSeen - CHAT_RECOVERY_OVERLAP))
}

/**
 * Puts the overlap back together: by message id, because that is the only identity the server and
 * this cache agree on for a row neither of them wrote twice.
 *
 * `nextCursor` and `hasMore` are left exactly as they were — they describe the way OLDER, and
 * recovery only ever reads forward.
 */
export function mergeChatMessages(
  page: ChatMessagesPage,
  incoming: readonly ChatMessage[],
): ChatMessagesPage {
  const known = new Set(page.items.map((item) => item.id))
  const added = incoming.filter((item) => !known.has(item.id))
  if (added.length === 0) {
    return page
  }

  return { ...page, items: [...page.items, ...added].sort((a, b) => Number(a.seq) - Number(b.seq)) }
}

/**
 * Nothing is lost while the tab sleeps.
 *
 * Three triggers, all of them the same question — "was the pipe interrupted?": the shared SSE
 * stream (re)opening, its 45 s silence watchdog firing, and the tab coming back to the front.
 * A missed `chat_message_created` is not hypothetical: `postgres-event-bus.ts` drops whatever is
 * published while it reconnects, so one deploy makes every message sent in that window invisible
 * to everybody until something asks again. This is the something.
 */
export function useChatRecovery(conversationId: string | null): void {
  const queryClient = useQueryClient()
  const runningRef = useRef(false)

  useEffect(() => {
    if (conversationId === null) {
      return
    }

    const recover = async (): Promise<void> => {
      if (runningRef.current) {
        return
      }
      runningRef.current = true
      try {
        const key = chatKeys.messages(conversationId)
        const current = queryClient.getQueryData<ChatMessagesPage>(key)
        const fetched = await fetchChatMessagesSince(
          conversationId,
          recoveryCursor(current?.items ?? []),
        )
        queryClient.setQueryData<ChatMessagesPage>(key, (page) =>
          page === undefined ? fetched : mergeChatMessages(page, fetched.items),
        )
      } catch {
        // Best-effort by design: a recovery that fails is asked again by the next trigger, and
        // the live signal is unaffected. Turning a reconnect into a red screen would be worse
        // than the gap it is trying to close.
      } finally {
        runningRef.current = false
      }
    }

    const onStreamOpen = (): void => void recover()
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        void recover()
      }
    }

    window.addEventListener(REALTIME_STREAM_OPEN_EVENT, onStreamOpen)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener(REALTIME_STREAM_OPEN_EVENT, onStreamOpen)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [conversationId, queryClient])
}
