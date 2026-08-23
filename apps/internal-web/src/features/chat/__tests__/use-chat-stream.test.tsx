import {
  CHAT_RECOVERY_OVERLAP,
  chatKeys,
  type ChatMessage,
  type ChatMessagesPage,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { Suspense } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ConversationPane } from '~/features/chat/conversation-pane'
import { mergeChatMessages, useChatRecovery } from '~/features/chat/use-chat-stream'
import { REALTIME_STREAM_OPEN_EVENT } from '~/lib/use-realtime-event-stream'

const CONVERSATION_ID = '99999999-9999-4999-8999-999999999999'

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function message(seq: number, body = `poruka ${seq}`): ChatMessage {
  return {
    id: uuid(seq),
    conversationId: CONVERSATION_ID,
    seq: String(seq),
    clientMsgId: uuid(500 + seq),
    author: { id: uuid(900), name: 'Slavko Jović', initials: 'SJ' },
    body,
    quote: null,
    systemKind: null,
    systemMeta: null,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-08-23T08:42:00.000Z',
    seenByAll: false,
    reactionCount: 0,
    mentions: [],
    reactedByMe: false,
  }
}

function page(items: ChatMessage[]): ChatMessagesPage {
  return { items, nextCursor: null, hasMore: false }
}

/**
 * The server as it really behaves: it holds 41 AND 42, and answers with everything strictly newer
 * than the `afterSeq` it was handed. That is the whole point — 41 was still committing when this
 * client already saw 42, so only a request that reaches BACK can ever see it again.
 */
let urls: string[] = []
function installFetch(store: ChatMessage[], firstRead = store): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    urls.push(url)
    const afterSeq = new URL(url, 'http://x').searchParams.get('afterSeq')
    // No cursor means "what is at the bottom", and that read happened BEFORE 41 committed —
    // which is the only reason there is anything to recover.
    if (afterSeq === null) {
      return Response.json(page(firstRead))
    }
    return Response.json(page(store.filter((item) => Number(item.seq) > Number(afterSeq))))
  }) as unknown as typeof fetch
}

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }): React.ReactElement {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('mergeChatMessages', () => {
  it('keeps a message it already has exactly once, in seq order', () => {
    const merged = mergeChatMessages(page([message(40), message(42)]), [message(41), message(42)])

    expect(merged.items.map((item) => item.seq)).toEqual(['40', '41', '42'])
  })

  /**
   * ⚠ The overlap of twenty ALWAYS brings back rows the cache already holds. Skipping them as
   * duplicates threw away the only news they carried — this is how a tick given at the next desk
   * stayed invisible until somebody happened to say something.
   */
  it('takes the fresher copy of a message it already holds', () => {
    const held = message(42)
    const ticked: ChatMessage = { ...held, reactionCount: 3, reactedByMe: true }

    const merged = mergeChatMessages(page([message(41), held]), [ticked])

    expect(merged.items).toHaveLength(2)
    expect(merged.items.at(-1)).toMatchObject({ reactionCount: 3, reactedByMe: true })
  })

  it('leaves the older-page cursor alone — recovery only ever reads forward', () => {
    const current: ChatMessagesPage = { items: [message(42)], nextCursor: '42', hasMore: true }

    expect(mergeChatMessages(current, [message(43)])).toMatchObject({
      nextCursor: '42',
      hasMore: true,
    })
  })
})

describe('useChatRecovery', () => {
  beforeEach(() => {
    urls = []
  })

  it('reaches back past what it has seen, and the message written in the gap arrives', async () => {
    installFetch([message(41), message(42)])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    // The client saw 42 and never saw 41 — `seq` is handed out at INSERT and becomes visible at
    // COMMIT, so this is not an edge case, it is Tuesday.
    queryClient.setQueryData(chatKeys.messages(CONVERSATION_ID), page([message(42)]))

    renderHook(() => useChatRecovery(CONVERSATION_ID), { wrapper: wrapper(queryClient) })
    window.dispatchEvent(new Event(REALTIME_STREAM_OPEN_EVENT))

    await waitFor(() => {
      const cached = queryClient.getQueryData<ChatMessagesPage>(chatKeys.messages(CONVERSATION_ID))
      expect(cached?.items.map((item) => item.seq)).toEqual(['41', '42'])
    })
    expect(urls[0]).toContain(`afterSeq=${42 - CHAT_RECOVERY_OVERLAP}`)
  })

  it('asks again when the tab comes back to the front', async () => {
    installFetch([message(42), message(43)])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(chatKeys.messages(CONVERSATION_ID), page([message(42)]))

    renderHook(() => useChatRecovery(CONVERSATION_ID), { wrapper: wrapper(queryClient) })
    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => {
      const cached = queryClient.getQueryData<ChatMessagesPage>(chatKeys.messages(CONVERSATION_ID))
      expect(cached?.items.map((item) => item.seq)).toEqual(['42', '43'])
    })
  })

  it('stops listening once the conversation is closed', async () => {
    installFetch([message(42)])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(chatKeys.messages(CONVERSATION_ID), page([message(42)]))

    const { unmount } = renderHook(() => useChatRecovery(CONVERSATION_ID), {
      wrapper: wrapper(queryClient),
    })
    unmount()
    window.dispatchEvent(new Event(REALTIME_STREAM_OPEN_EVENT))

    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(urls).toEqual([])
  })
})

describe('the conversation on screen', () => {
  beforeEach(() => {
    urls = []
  })

  it('recovers what it missed — the hook is actually wired to the pane', async () => {
    installFetch([message(41, 'poruka koja je stigla dok si spavao'), message(42)], [message(42)])
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(chatKeys.messages(CONVERSATION_ID), page([message(42)]))

    render(
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<p>…</p>}>
          <ConversationPane
            conversationId={CONVERSATION_ID}
            unreadCount={0}
            authorName="Marko Petrović"
          />
        </Suspense>
      </QueryClientProvider>,
    )
    await screen.findByText('poruka 42')
    window.dispatchEvent(new Event(REALTIME_STREAM_OPEN_EVENT))

    expect(await screen.findByText('poruka koja je stigla dok si spavao')).toBeInTheDocument()
  })
})
