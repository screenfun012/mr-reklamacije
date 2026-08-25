import { describe, expect, it } from 'vitest'

import {
  CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE,
  CHAT_MESSAGES_PAGE_SIZE,
  CHAT_MESSAGE_MAX_LENGTH,
} from '../../constants/chat.js'
import {
  ChatChannelManagementItemSchema,
  ChatChannelManagementQuerySchema,
  ChatClaimThreadLookupSchema,
  ChatMembersResponseSchema,
  ChatMessageSchema,
  ChatMessagesQuerySchema,
  ChatSendInputSchema,
} from '../chat.schema.js'

const MESSAGE = {
  id: '11111111-1111-4111-8111-111111111111',
  conversationId: '22222222-2222-4222-8222-222222222222',
  seq: '42',
  clientMsgId: '33333333-3333-4333-8333-333333333333',
  author: { id: '44444444-4444-4444-8444-444444444444', name: 'Marko Petrović', initials: 'MP' },
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

describe('the chat wire', () => {
  it('carries seq as a string, because JSON has no integer wide enough for a bigint', () => {
    expect(ChatMessageSchema.parse(MESSAGE).seq).toBe('42')
    expect(() => ChatMessageSchema.parse({ ...MESSAGE, seq: 42 })).toThrow()
    expect(() => ChatMessageSchema.parse({ ...MESSAGE, seq: 'x' })).toThrow()
  })

  it('lets a system message have no author, and a deleted message no words', () => {
    expect(
      ChatMessageSchema.parse({ ...MESSAGE, author: null, systemKind: 'thread_created', body: '' }),
    ).toMatchObject({ author: null, body: '' })
  })

  it('refuses both cursors at once — a window is either newer or older, never both', () => {
    // Accepting both would silently honour one of the two and look like it worked.
    expect(() => ChatMessagesQuerySchema.parse({ afterSeq: '10', beforeSeq: '20' })).toThrow()
    expect(ChatMessagesQuerySchema.parse({ afterSeq: '10' }).limit).toBe(CHAT_MESSAGES_PAGE_SIZE)
    expect(ChatMessagesQuerySchema.parse({ beforeSeq: '20' }).limit).toBe(CHAT_MESSAGES_PAGE_SIZE)
    expect(ChatMessagesQuerySchema.parse({}).afterSeq).toBeUndefined()
  })

  it('caps a page at 100 and refuses zero', () => {
    expect(() => ChatMessagesQuerySchema.parse({ limit: 0 })).toThrow()
    expect(() => ChatMessagesQuerySchema.parse({ limit: 101 })).toThrow()
  })

  it('demands the client id on every send — that is what makes a retry safe', () => {
    expect(() => ChatSendInputSchema.parse({ body: 'zdravo' })).toThrow()
    expect(
      ChatSendInputSchema.parse({ clientMsgId: MESSAGE.clientMsgId, body: '  zdravo  ' }).body,
    ).toBe('zdravo')
  })

  it('refuses a message longer than the column holds', () => {
    expect(() =>
      ChatSendInputSchema.parse({
        clientMsgId: MESSAGE.clientMsgId,
        body: 'x'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1),
      }),
    ).toThrow()
  })

  /**
   * This used to assert the opposite, and the change is deliberate: a photo on its own is a
   * message (Nikola, 2026-08-24).
   *
   * ⚠ The rule did not disappear, it moved. `.min(1)` fails at the FIELD level, before any
   * object-wide refinement runs, and this schema never sees the files at all — they arrive as
   * multipart, not as JSON. So "empty only when a file rides along" lives in `ChatService.send`,
   * where the parsed input and the processed files are both in hand, and
   * `chat-attachments.integration.test.ts` is what proves an empty message with no file is still
   * refused.
   */
  it('accepts an empty body — a photo needs no caption', () => {
    expect(ChatSendInputSchema.parse({ clientMsgId: MESSAGE.clientMsgId, body: '   ' }).body).toBe(
      '',
    )
  })
})

describe('chat threads and channel management wire', () => {
  const conversation = {
    id: '55555555-5555-4555-8555-555555555555',
    type: 'claim',
    title: 'MR-42',
    subtitle: 'Partner · Motor',
    claimKind: 'emotive',
    claimId: '66666666-6666-4666-8666-666666666666',
    unreadCount: 0,
    isLocked: false,
    isMuted: false,
    lastMessageAt: null,
  }

  it('parses both an existing and an as-yet uncreated claim thread', () => {
    expect(
      ChatClaimThreadLookupSchema.parse({
        conversation: null,
        canCreateThread: true,
      }),
    ).toEqual({ conversation: null, canCreateThread: true })
    expect(
      ChatClaimThreadLookupSchema.parse({
        conversation,
        canCreateThread: false,
      }),
    ).toEqual({ conversation, canCreateThread: false })
  })

  it('requires the member-management capability on the members response', () => {
    expect(() => ChatMembersResponseSchema.parse({ members: [], addable: [] })).toThrow()
  })

  it('normalizes a management query and refuses a page larger than fifty rows', () => {
    expect(ChatChannelManagementQuerySchema.parse({ search: '  Servis  ' })).toEqual({
      search: 'Servis',
      page: 1,
      pageSize: CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE,
    })
    expect(() => ChatChannelManagementQuerySchema.parse({ page: 1, pageSize: 51 })).toThrow()
  })

  it('accepts a channel whose creator account no longer exists', () => {
    expect(
      ChatChannelManagementItemSchema.parse({
        id: '77777777-7777-4777-8777-777777777777',
        name: 'Servis',
        creatorName: null,
        memberCount: 4,
      }),
    ).toMatchObject({ creatorName: null })
  })
})
