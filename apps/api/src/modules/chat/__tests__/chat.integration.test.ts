import { schema } from '@mr/db'
import {
  ChatConversationListResponseSchema,
  ChatConversationType,
  ChatMessagesPageSchema,
  type Permission,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
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

describe('Chat reads', () => {
  let ctx: TestDbContext
  let container: Container
  let generalId: string
  let emotiveClaimId: string
  let emotiveThreadId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)

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

  async function sendRaw(conversationId: string, body: string): Promise<void> {
    await ctx.db.insert(schema.chatMessages).values({
      conversationId,
      clientMsgId: crypto.randomUUID(),
      authorId: TEST_USER_ID,
      body,
    })
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
