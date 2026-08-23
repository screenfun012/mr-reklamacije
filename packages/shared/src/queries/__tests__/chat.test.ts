import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  chatConversationsOptions,
  chatKeys,
  chatMessagesOptions,
  markChatRead,
  sendChatMessage,
} from '../chat.js'

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111'

function stubFetch(body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('chatConversationsOptions', () => {
  it('reads the list under the key the SSE handler invalidates', async () => {
    const fetchMock = stubFetch({ items: [], unreadTotal: 0 })
    const options = chatConversationsOptions()

    expect(options.queryKey).toEqual(chatKeys.conversations())
    expect(options.staleTime).toBe(15_000)

    await expect(options.queryFn?.({} as never)).resolves.toEqual({ items: [], unreadTotal: 0 })
    // The helper resolves a base URL outside the browser, so the path is what this pins.
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/chat/conversations')
  })
})

describe('chatMessagesOptions', () => {
  it('never goes stale and never refetches on focus — recovery is the mechanism', () => {
    const options = chatMessagesOptions(CONVERSATION_ID)

    expect(options.queryKey).toEqual(chatKeys.messages(CONVERSATION_ID))
    expect(options.staleTime).toBe(0)
    // ⚠ If this is ever true, a broken recovery stops being visible: the focus refetch quietly
    // fills the gap the overlap fetch was supposed to close.
    expect(options.refetchOnWindowFocus).toBe(false)
  })

  it('asks for the newest page — no cursor', async () => {
    const fetchMock = stubFetch({ items: [], nextCursor: null, hasMore: false })

    await chatMessagesOptions(CONVERSATION_ID).queryFn?.({} as never)

    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      `/api/chat/conversations/${CONVERSATION_ID}/messages`,
    )
  })
})

describe('sendChatMessage', () => {
  it('posts the client-minted id so a retry lands exactly once', async () => {
    const message = {
      id: '22222222-2222-4222-8222-222222222222',
      conversationId: CONVERSATION_ID,
      seq: '42',
      clientMsgId: '33333333-3333-4333-8333-333333333333',
      author: { id: null, name: 'Marko', initials: 'MP' },
      body: 'Stigao motor',
      quoteOf: null,
      systemKind: null,
      systemMeta: null,
      editedAt: null,
      deletedAt: null,
      createdAt: '2026-08-23T09:00:00.000Z',
      reactionCount: 0,
      mentions: [],
      reactedByMe: false,
    }
    const fetchMock = stubFetch(message)

    await expect(
      sendChatMessage(CONVERSATION_ID, {
        clientMsgId: '33333333-3333-4333-8333-333333333333',
        body: 'Stigao motor',
      }),
    ).resolves.toEqual(message)

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/api/chat/conversations/${CONVERSATION_ID}/messages`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      clientMsgId: '33333333-3333-4333-8333-333333333333',
      body: 'Stigao motor',
    })
  })
})

describe('markChatRead', () => {
  it('sends seq as a string — a bigint that became a number is a bug nobody sees', async () => {
    const fetchMock = stubFetch(null)

    await markChatRead(CONVERSATION_ID, '9007199254740993')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`/api/chat/conversations/${CONVERSATION_ID}/read`)
    expect(String(init.body)).toBe('{"lastSeq":"9007199254740993"}')
  })
})
