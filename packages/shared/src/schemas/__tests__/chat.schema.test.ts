import { describe, expect, it } from 'vitest'

import { CHAT_MESSAGES_PAGE_SIZE, CHAT_MESSAGE_MAX_LENGTH } from '../../constants/chat.js'
import { ChatMessageSchema, ChatMessagesQuerySchema, ChatSendInputSchema } from '../chat.schema.js'

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
  reactionCount: 0,
  mentions: [],
  reactedByMe: false,
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

  it('refuses an empty message and one longer than the column holds', () => {
    expect(() =>
      ChatSendInputSchema.parse({ clientMsgId: MESSAGE.clientMsgId, body: '   ' }),
    ).toThrow()
    expect(() =>
      ChatSendInputSchema.parse({
        clientMsgId: MESSAGE.clientMsgId,
        body: 'x'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1),
      }),
    ).toThrow()
  })
})
