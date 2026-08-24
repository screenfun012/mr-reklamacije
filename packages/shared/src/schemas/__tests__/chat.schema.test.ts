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
