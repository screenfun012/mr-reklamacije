import { schema } from '@mr/db'
import {
  ChatConversationListResponseSchema,
  ChatConversationType,
  ChatEventType,
  ChatMessageSchema,
  ChatMessagesPageSchema,
  ChatSystemKind,
  type Permission,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { NotFoundError } from '../../../core/errors/domain-errors.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer, createChatTestApp, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { ChatActor } from '../chat.validators.js'

/** Reads claims: the office, a viewer, an operator. This is the actor a thread is meant for. */
const CLAIM_READER_PERMISSIONS = [
  'emotive_claims.view',
  'domace_claims.view',
] as const satisfies readonly Permission[]
const CLAIM_READER: ChatActor = { id: TEST_USER_ID, permissions: CLAIM_READER_PERMISSIONS }

/**
 * A serviser: he belongs in the internal app (intake), and he may not read claims. A claim thread
 * must not exist for him — not hidden, not forbidden: absent.
 */
const SERVISER_PERMISSIONS = ['intake_orders.view'] as const satisfies readonly Permission[]
const SERVISER: ChatActor = { id: TEST_USER_ID, permissions: SERVISER_PERMISSIONS }

/** The portal client. `view_own_customer` is not a key to anything internal (spec §3.3). */
const PORTAL_CLIENT_PERMISSIONS = [
  'emotive_claims.view_own_customer',
] as const satisfies readonly Permission[]

/** Somebody else in the shop. Unread is only ever what SOMEONE ELSE said. */
const OTHER_USER_ID = '00000000-0000-4000-8000-0000000000ff'

describe('Chat', () => {
  let ctx: TestDbContext
  let container: Container
  let bus: RecordingEventBus
  let generalId: string
  let emotiveClaimId: string
  let emotiveThreadId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    bus = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, bus)
    await ensureTestUser(ctx.db)
    await ensureTestUser(ctx.db, OTHER_USER_ID)

    const [manufacturer] = await ctx.db
      .insert(schema.engineManufacturers)
      .values({ code: 'CHAT-MFG', name: 'Chat Mfg' })
      .returning({ id: schema.engineManufacturers.id })
    const [engineType] = await ctx.db
      .insert(schema.engineTypes)
      .values({ code: 'CHAT-ENG', manufacturerId: manufacturer?.id ?? '' })
      .returning({ id: schema.engineTypes.id })
    const [claim] = await ctx.db
      .insert(schema.emotiveClaims)
      .values({
        warrantyReport: 'Chat thread claim',
        engineTypeId: engineType?.id ?? '',
        dateOfClaim: new Date('2026-08-01'),
        mrNumber: 'MR-CHAT-1',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.emotiveClaims.id })
    emotiveClaimId = claim?.id ?? ''

    // The general channel is a system seed — every database has exactly one, and a second one is
    // refused by a unique index. So the test reads it rather than making its own.
    const [general] = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.type, ChatConversationType.General))
      .limit(1)
    if (general === undefined) {
      throw new Error('No general channel — run db:seed')
    }
    generalId = general.id

    const [thread] = await ctx.db
      .insert(schema.chatConversations)
      .values({
        type: ChatConversationType.Claim,
        emotiveClaimId,
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.chatConversations.id })
    emotiveThreadId = thread?.id ?? ''
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function sendRaw(
    conversationId: string,
    body: string,
    authorId = TEST_USER_ID,
  ): Promise<bigint> {
    const [row] = await ctx.db
      .insert(schema.chatMessages)
      .values({ conversationId, clientMsgId: crypto.randomUUID(), authorId, body })
      .returning({ seq: schema.chatMessages.seq })

    return row?.seq ?? 0n
  }

  async function unreadOf(conversationId: string): Promise<number> {
    const list = await container.chatService.listConversations(CLAIM_READER)
    return list.items.find((item) => item.id === conversationId)?.unreadCount ?? -1
  }

  it('lists the general channel for anyone who may enter the internal app', async () => {
    const list = await container.chatService.listConversations(SERVISER)
    expect(list.items.map((item) => item.id)).toContain(generalId)
  })

  it('does not list a claim thread to someone who may not read that claim', async () => {
    const serviser = await container.chatService.listConversations(SERVISER)
    expect(serviser.items.map((item) => item.id)).not.toContain(emotiveThreadId)

    const reader = await container.chatService.listConversations(CLAIM_READER)
    expect(reader.items.map((item) => item.id)).toContain(emotiveThreadId)
  })

  it('names a claim thread by its MR number', async () => {
    const list = await container.chatService.listConversations(CLAIM_READER)
    const thread = list.items.find((item) => item.id === emotiveThreadId)
    expect(thread?.title).toBe('MR-CHAT-1')
    expect(thread?.claimId).toBe(emotiveClaimId)
  })

  it('drops a thread whose claim is soft-deleted, and brings it back with the claim', async () => {
    await ctx.db
      .update(schema.emotiveClaims)
      .set({ deletedAt: new Date() })
      .where(eq(schema.emotiveClaims.id, emotiveClaimId))

    const hidden = await container.chatService.listConversations(CLAIM_READER)
    expect(hidden.items.map((item) => item.id)).not.toContain(emotiveThreadId)

    await ctx.db
      .update(schema.emotiveClaims)
      .set({ deletedAt: null })
      .where(eq(schema.emotiveClaims.id, emotiveClaimId))

    const back = await container.chatService.listConversations(CLAIM_READER)
    expect(back.items.map((item) => item.id)).toContain(emotiveThreadId)
  })

  it('lists a channel only to its members', async () => {
    const [channel] = await ctx.db
      .insert(schema.chatConversations)
      .values({ type: ChatConversationType.Channel, name: 'Nabavka', createdBy: TEST_USER_ID })
      .returning({ id: schema.chatConversations.id })
    const channelId = channel?.id ?? ''

    const outsider = await container.chatService.listConversations(CLAIM_READER)
    expect(outsider.items.map((item) => item.id)).not.toContain(channelId)

    await ctx.db
      .insert(schema.chatMembers)
      .values({ conversationId: channelId, userId: TEST_USER_ID })

    const member = await container.chatService.listConversations(CLAIM_READER)
    expect(member.items.map((item) => item.id)).toContain(channelId)
  })

  it('404s a claim thread the actor may not read, and never 403 — existence is not leaked', async () => {
    const app = createChatTestApp(container, testUser([...SERVISER_PERMISSIONS]))
    const res = await app.request(`/api/chat/conversations/${emotiveThreadId}/messages`)
    expect(res.status).toBe(404)
  })

  it('refuses a portal client at the door — view_own_customer opens nothing internal', async () => {
    const app = createChatTestApp(container, testUser([...PORTAL_CLIENT_PERMISSIONS]))

    const list = await app.request('/api/chat/conversations')
    expect(list.status).toBe(403)

    const messages = await app.request(`/api/chat/conversations/${generalId}/messages`)
    expect(messages.status).toBe(403)
  })

  it('pages backwards by seq and forwards by seq, and never uses offset', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await sendRaw(generalId, `poruka ${String(i)}`)
    }

    const newest = await container.chatService.listMessages(generalId, { limit: 2 }, CLAIM_READER)
    expect(newest.items.map((m) => m.body)).toEqual(['poruka 4', 'poruka 5'])
    expect(newest.hasMore).toBe(true)

    const older = await container.chatService.listMessages(
      generalId,
      { beforeSeq: BigInt(newest.items[0]?.seq ?? '0'), limit: 2 },
      CLAIM_READER,
    )
    expect(older.items.map((m) => m.body)).toEqual(['poruka 2', 'poruka 3'])
    expect(older.hasMore).toBe(true)
    expect(older.nextCursor).toBe(older.items[0]?.seq)

    const newer = await container.chatService.listMessages(
      generalId,
      { afterSeq: BigInt(older.items[1]?.seq ?? '0'), limit: 50 },
      CLAIM_READER,
    )
    expect(newer.items.map((m) => m.body)).toEqual(['poruka 4', 'poruka 5'])
    expect(newer.hasMore).toBe(false)
    expect(newer.nextCursor).toBeNull()
  })

  it('serves a deleted message as a row without its words', async () => {
    await sendRaw(generalId, 'greška')
    await ctx.db.update(schema.chatMessages).set({ deletedAt: new Date() })

    const page = await container.chatService.listMessages(generalId, { limit: 50 }, CLAIM_READER)
    expect(page.items).toHaveLength(1)
    expect(page.items[0]?.body).toBe('')
    expect(page.items[0]?.deletedAt).not.toBeNull()
  })

  async function postMessage(
    app: ReturnType<typeof createChatTestApp>,
    conversationId: string,
    payload: Record<string, unknown>,
  ): Promise<Response> {
    return app.request(`/api/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  it('refuses a quote that points at another conversation', async () => {
    const elsewhere = await container.chatService.send(
      generalId,
      { clientMsgId: crypto.randomUUID(), body: 'u opštem' },
      CLAIM_READER,
    )

    // The foreign key only proves the message exists — it would happily take one from a thread
    // the sender cannot even open, leaving a pointer nothing can render.
    await expect(
      container.chatService.send(
        emotiveThreadId,
        { clientMsgId: crypto.randomUUID(), body: 'citiram tuđe', quoteOf: elsewhere.message.id },
        CLAIM_READER,
      ),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('takes a quote that points inside the same conversation', async () => {
    const quoted = await container.chatService.send(
      generalId,
      { clientMsgId: crypto.randomUUID(), body: 'original' },
      CLAIM_READER,
    )
    const reply = await container.chatService.send(
      generalId,
      { clientMsgId: crypto.randomUUID(), body: 'odgovor', quoteOf: quoted.message.id },
      CLAIM_READER,
    )

    expect(reply.message.quoteOf).toBe(quoted.message.id)
  })

  it('accepts the same client id twice and stores one message', async () => {
    const clientMsgId = crypto.randomUUID()
    const first = await container.chatService.send(
      generalId,
      { clientMsgId, body: 'zdravo' },
      CLAIM_READER,
    )
    const second = await container.chatService.send(
      generalId,
      { clientMsgId, body: 'zdravo' },
      CLAIM_READER,
    )

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.message.id).toBe(first.message.id)

    const page = await container.chatService.listMessages(generalId, { limit: 50 }, CLAIM_READER)
    expect(page.items).toHaveLength(1)
  })

  it('answers 201 the first time and 200 to the retry — a flaky tablet may resend', async () => {
    const app = createChatTestApp(container, testUser([...CLAIM_READER_PERMISSIONS]))
    const payload = { clientMsgId: crypto.randomUUID(), body: 'ponovljeno' }

    const first = await postMessage(app, generalId, payload)
    expect(first.status).toBe(201)
    const second = await postMessage(app, generalId, payload)
    expect(second.status).toBe(200)

    expect(ChatMessageSchema.parse(await second.json()).id).toBe(
      ChatMessageSchema.parse(await first.json()).id,
    )
  })

  it('publishes one signal, and it carries no words', async () => {
    const clientMsgId = crypto.randomUUID()
    const { message } = await container.chatService.send(
      generalId,
      { clientMsgId, body: 'tajna koja ne sme na žicu' },
      CLAIM_READER,
    )

    expect(bus.chatEvents).toEqual([
      { type: ChatEventType.MessageCreated, conversationId: generalId, messageId: message.id },
    ])

    // The retry stored nothing, so it announces nothing.
    await container.chatService.send(
      generalId,
      { clientMsgId, body: 'tajna koja ne sme na žicu' },
      CLAIM_READER,
    )
    expect(bus.chatEvents).toHaveLength(1)
  })

  it('404s a post into a conversation the actor may not see — existence is not leaked', async () => {
    const app = createChatTestApp(container, testUser([...SERVISER_PERMISSIONS]))
    const res = await postMessage(app, emotiveThreadId, {
      clientMsgId: crypto.randomUUID(),
      body: 'ne bih smeo ovde',
    })
    expect(res.status).toBe(404)
  })

  it('counts what other people said, and never my own', async () => {
    await sendRaw(generalId, 'moja poruka')
    await sendRaw(generalId, 'tuđa prva', OTHER_USER_ID)
    await sendRaw(generalId, 'tuđa druga', OTHER_USER_ID)

    const list = await container.chatService.listConversations(CLAIM_READER)
    expect(list.items.find((item) => item.id === generalId)?.unreadCount).toBe(2)
    expect(list.unreadTotal).toBe(2)
  })

  it('never counts a system message — it is a record, not somebody talking', async () => {
    await ctx.db.insert(schema.chatMessages).values({
      conversationId: generalId,
      clientMsgId: crypto.randomUUID(),
      authorId: null,
      body: '',
      systemKind: ChatSystemKind.OutcomeChanged,
    })

    expect(await unreadOf(generalId)).toBe(0)
  })

  it('never counts a deleted message', async () => {
    await sendRaw(generalId, 'povučeno', OTHER_USER_ID)
    await ctx.db.update(schema.chatMessages).set({ deletedAt: new Date() })

    expect(await unreadOf(generalId)).toBe(0)
  })

  it('never moves a read marker backwards', async () => {
    const first = await sendRaw(generalId, 'prva', OTHER_USER_ID)
    await sendRaw(generalId, 'druga', OTHER_USER_ID)
    const last = await sendRaw(generalId, 'treća', OTHER_USER_ID)

    await container.chatService.markRead(generalId, last, CLAIM_READER)
    // The late one: sent before the other, arriving after it. It must change nothing.
    await container.chatService.markRead(generalId, first, CLAIM_READER)

    expect(await unreadOf(generalId)).toBe(0)
  })

  it('counts only what came after the marker', async () => {
    const first = await sendRaw(generalId, 'prva', OTHER_USER_ID)
    await sendRaw(generalId, 'druga', OTHER_USER_ID)
    await sendRaw(generalId, 'treća', OTHER_USER_ID)

    await container.chatService.markRead(generalId, first, CLAIM_READER)

    expect(await unreadOf(generalId)).toBe(2)
  })

  it('keeps a muted conversation out of the sum but not out of its own badge', async () => {
    await sendRaw(generalId, 'tuđa', OTHER_USER_ID)
    await ctx.db
      .insert(schema.chatMutes)
      .values({ conversationId: generalId, userId: TEST_USER_ID })

    const list = await container.chatService.listConversations(CLAIM_READER)
    expect(list.items.find((item) => item.id === generalId)?.unreadCount).toBe(1)
    expect(list.unreadTotal).toBe(0)
  })

  it('answers 204 to a read marker, and 404 where the conversation is not his', async () => {
    const reader = createChatTestApp(container, testUser([...CLAIM_READER_PERMISSIONS]))
    const ok = await reader.request(`/api/chat/conversations/${generalId}/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lastSeq: '1' }),
    })
    expect(ok.status).toBe(204)

    const serviser = createChatTestApp(container, testUser([...SERVISER_PERMISSIONS]))
    const hidden = await serviser.request(`/api/chat/conversations/${emotiveThreadId}/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lastSeq: '1' }),
    })
    expect(hidden.status).toBe(404)
  })

  it('answers both reads in the shape the client is promised', async () => {
    await sendRaw(generalId, 'zdravo')
    const app = createChatTestApp(container, testUser([...CLAIM_READER_PERMISSIONS]))

    const list = await app.request('/api/chat/conversations')
    expect(list.status).toBe(200)
    const conversations = ChatConversationListResponseSchema.parse(await list.json())
    expect(conversations.items.map((item) => item.id)).toContain(generalId)

    const messages = await app.request(`/api/chat/conversations/${generalId}/messages?limit=10`)
    expect(messages.status).toBe(200)
    const page = ChatMessagesPageSchema.parse(await messages.json())
    expect(page.items[0]?.body).toBe('zdravo')
    expect(page.items[0]?.author?.name).toBe('Test Operator')
  })
})
