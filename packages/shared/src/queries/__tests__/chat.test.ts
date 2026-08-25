import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ClaimKind } from '../../enums.js'
import {
  chatChannelManagementOptions,
  chatClaimThreadOptions,
  chatConversationsOptions,
  chatKeys,
  chatMessagesOptions,
  createChatChannel,
  invalidateChatConversationMetadataQueries,
  markChatRead,
  renameChatChannel,
  sendChatMessage,
} from '../chat.js'

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111'
const CHANNEL_ID = '55555555-5555-4555-8555-555555555555'

function stubFetch(body: unknown, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response(status === 204 ? null : JSON.stringify(body), {
        status,
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
      quote: null,
      systemKind: null,
      systemMeta: null,
      editedAt: null,
      deletedAt: null,
      createdAt: '2026-08-23T09:00:00.000Z',
      seenByAll: false,
      reactedBy: [],
      attachments: [],
      mentions: [],
    }
    // A send answers with the message PLUS how many of its files were lost — its own shape, so a
    // message read later can never claim files went missing.
    const fetchMock = stubFetch({ ...message, partialFiles: 0 })

    await expect(
      sendChatMessage(CONVERSATION_ID, {
        clientMsgId: '33333333-3333-4333-8333-333333333333',
        body: 'Stigao motor',
      }),
    ).resolves.toEqual({ ...message, partialFiles: 0 })

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

describe('claim thread lookup', () => {
  const CLAIM_ID = '44444444-4444-4444-8444-444444444444'

  it('keeps EMOTIVE and DOMACE thread lookups separate and gets the requested claim', async () => {
    const fetchMock = stubFetch({ conversation: null, canCreateThread: true })
    const options = chatClaimThreadOptions(ClaimKind.Emotive, CLAIM_ID)

    expect(chatKeys.claimThread(ClaimKind.Emotive, CLAIM_ID)).not.toEqual(
      chatKeys.claimThread(ClaimKind.Domace, CLAIM_ID),
    )
    expect(options.queryKey).toEqual(chatKeys.claimThread(ClaimKind.Emotive, CLAIM_ID))
    await expect(options.queryFn?.({} as never)).resolves.toEqual({
      conversation: null,
      canCreateThread: true,
    })
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
      `/api/chat/claims/emotive/${CLAIM_ID}/thread`,
    )
  })
})

describe('channel management', () => {
  const USER_ID = '66666666-6666-4666-8666-666666666666'

  it('uses the normalized, URL-encoded management filters', async () => {
    const fetchMock = stubFetch({ items: [], total: 0, page: 2, pageSize: 25 })
    const options = chatChannelManagementOptions({
      search: '  Servis & delovi  ',
      page: 2,
      pageSize: 25,
    })

    expect(options.queryKey).toEqual(
      chatKeys.channelManagementList({ search: 'Servis & delovi', page: 2, pageSize: 25 }),
    )
    await expect(options.queryFn?.({} as never)).resolves.toEqual({
      items: [],
      total: 0,
      page: 2,
      pageSize: 25,
    })
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe('/api/chat/channels/manage')
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).search).toBe(
      '?search=Servis+%26+delovi&page=2&pageSize=25',
    )
  })

  it('creates a channel with the selected members', async () => {
    const fetchMock = stubFetch({
      id: CHANNEL_ID,
      type: 'channel',
      title: 'Servis',
      subtitle: '1 član',
      claimKind: null,
      claimId: null,
      unreadCount: 0,
      isLocked: false,
      isMuted: false,
      lastMessageAt: null,
    })

    await createChatChannel({ name: 'Servis', memberIds: [USER_ID] })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new URL(url).pathname).toBe('/api/chat/channels')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Servis', memberIds: [USER_ID] })
  })

  it('renames a channel through its no-content endpoint', async () => {
    const fetchMock = stubFetch(null, 204)

    await expect(renameChatChannel(CHANNEL_ID, 'Motori')).resolves.toBeUndefined()

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new URL(url).pathname).toBe(`/api/chat/conversations/${CHANNEL_ID}`)
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Motori' })
  })
})

describe('invalidateChatConversationMetadataQueries', () => {
  it('invalidates only claim lookups that resolve to the changed conversation', () => {
    const queryClient = new QueryClient()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const matchingClaimId = '77777777-7777-4777-8777-777777777777'
    const otherClaimId = '88888888-8888-4888-8888-888888888888'

    queryClient.setQueryData(chatKeys.claimThread(ClaimKind.Emotive, matchingClaimId), {
      conversation: { id: CHANNEL_ID },
      canCreateThread: false,
    })
    queryClient.setQueryData(chatKeys.claimThread(ClaimKind.Domace, otherClaimId), {
      conversation: { id: '99999999-9999-4999-8999-999999999999' },
      canCreateThread: false,
    })

    invalidateChatConversationMetadataQueries(queryClient, CHANNEL_ID)

    expect(spy).toHaveBeenCalledWith({ queryKey: chatKeys.conversations() })
    expect(spy).toHaveBeenCalledWith({ queryKey: chatKeys.members(CHANNEL_ID) })
    expect(spy).toHaveBeenCalledWith({ queryKey: chatKeys.people(CHANNEL_ID) })
    expect(spy).toHaveBeenCalledWith({ queryKey: chatKeys.channelManagement() })
    expect(spy).toHaveBeenCalledWith({
      queryKey: chatKeys.claimThread(ClaimKind.Emotive, matchingClaimId),
      exact: true,
    })
    expect(spy).not.toHaveBeenCalledWith({
      queryKey: chatKeys.claimThread(ClaimKind.Domace, otherClaimId),
      exact: true,
    })
  })
})
