import { schema } from '@mr/db'
import {
  ChatConversationType,
  NotificationEntityType,
  NotificationType,
  type Permission,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { ChatActor } from '../chat.validators.js'

const CLAIM_READER_PERMISSIONS = [
  'emotive_claims.view',
  'domace_claims.view',
] as const satisfies readonly Permission[]

/**
 * The bell, and the ONE chat event that reaches it (spec §3.2). Everything here is about who hears
 * it: named and able to see the room, never the author, never twice.
 */
describe('a mention rings the person it names', () => {
  let ctx: TestDbContext
  let container: Container
  let generalId: string
  let threadId: string
  let author: ChatActor
  let mentioned: string
  let outsider: string

  async function giveRole(userId: string, roleCode: string): Promise<void> {
    const [role] = await ctx.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, roleCode))
      .limit(1)
    if (role === undefined) {
      throw new Error(`Role ${roleCode} not found — system seeds must run in integration setup`)
    }
    await ctx.db
      .insert(schema.userRoles)
      .values({ userId, roleId: role.id, assignedBy: userId })
      .onConflictDoNothing()
  }

  async function makeUser(name: string, roleCode: string): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id,
      email: `mention-${id}@mrengines.rs`,
      name,
      isActive: true,
      accountStatus: 'approved',
    })
    await giveRole(id, roleCode)
    return id
  }

  async function rungFor(userId: string): Promise<string[]> {
    const rows = await ctx.db
      .select({ entityId: schema.notifications.entityId })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
    return rows.map((row) => row.entityId)
  }

  async function send(conversationId: string, body: string): Promise<string> {
    const result = await container.chatService.send(
      conversationId,
      { clientMsgId: crypto.randomUUID(), body },
      author,
    )
    return result.message.id
  }

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    await ensureTestUser(ctx.db)
    await ctx.db
      .update(schema.users)
      .set({ isActive: true, accountStatus: 'approved', name: 'Pisac Poruke' })
      .where(eq(schema.users.id, TEST_USER_ID))
    // ⚠ The author needs a real role, or `listPeopleFor` never returns him and "the author is not
    // rung" would pass because he was unreachable rather than because he was excluded. That is
    // exactly what it did until a mutation went green.
    await giveRole(TEST_USER_ID, 'claims_view')
    author = { id: TEST_USER_ID, permissions: CLAIM_READER_PERMISSIONS, roles: ['operator'] }

    mentioned = await makeUser('Pomenuti Kolega', 'claims_view')
    // Intake only: he is in the general channel with everyone, and in no claim thread.
    outsider = await makeUser('Serviser Prijem', 'intake_view')

    const [general] = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.type, ChatConversationType.General))
      .limit(1)
    generalId =
      general?.id ??
      (
        await ctx.db
          .insert(schema.chatConversations)
          .values({ type: ChatConversationType.General, name: 'Opšti kanal' })
          .returning({ id: schema.chatConversations.id })
      )[0]?.id ??
      ''

    const [manufacturer] = await ctx.db
      .insert(schema.engineManufacturers)
      .values({ code: 'MENTION-MFG', name: 'Mention Mfg' })
      .returning({ id: schema.engineManufacturers.id })
    const [engineType] = await ctx.db
      .insert(schema.engineTypes)
      .values({ code: 'MENTION-ENG', manufacturerId: manufacturer?.id ?? '' })
      .returning({ id: schema.engineTypes.id })
    const [claim] = await ctx.db
      .insert(schema.emotiveClaims)
      .values({
        warrantyReport: 'Mention thread claim',
        engineTypeId: engineType?.id ?? '',
        dateOfClaim: new Date('2026-08-01'),
        mrNumber: 'MR-MENTION-1',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.emotiveClaims.id })
    const [thread] = await ctx.db
      .insert(schema.chatConversations)
      .values({
        type: ChatConversationType.Claim,
        emotiveClaimId: claim?.id ?? '',
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.chatConversations.id })
    threadId = thread?.id ?? ''
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('rings the person named, exactly once, however many times the name appears', async () => {
    const messageId = await send(
      generalId,
      `@[Kolega](${mentioned}) i opet @[Kolega](${mentioned})`,
    )

    expect(await rungFor(mentioned)).toEqual([messageId])
  })

  it('never rings the person who wrote it', async () => {
    await send(generalId, `pišem sebi @[Ja](${TEST_USER_ID})`)

    expect(await rungFor(TEST_USER_ID)).toEqual([])
  })

  it('does not ring somebody who cannot see the conversation', async () => {
    // The serviser reads no claims, so this thread is not his — a mention written here reaches
    // nobody, and the message is still stored and still says what it says (spec §5 row 7).
    await send(threadId, `@[Serviser](${outsider}) pogledaj`)

    expect(await rungFor(outsider)).toEqual([])
  })

  it('@svi rings everybody who can see the conversation, and nobody else', async () => {
    const messageId = await send(generalId, '@[svi](all) hitno')

    expect(await rungFor(mentioned)).toEqual([messageId])
    // The general channel is the whole shop, the serviser included.
    expect(await rungFor(outsider)).toEqual([messageId])
    expect(await rungFor(TEST_USER_ID)).toEqual([])
  })

  it('@svi in a claim thread reaches only the people who may read that claim', async () => {
    const messageId = await send(threadId, '@[svi](all) pregled gotov')

    expect(await rungFor(mentioned)).toEqual([messageId])
    expect(await rungFor(outsider)).toEqual([])
  })

  it('rings a person once even when @svi and their own name are both written', async () => {
    const messageId = await send(generalId, `@[svi](all) a naročito @[Kolega](${mentioned})`)

    expect(await rungFor(mentioned)).toEqual([messageId])
  })

  it('rings a name added by a correction — and does not ring the first ones again', async () => {
    const messageId = await send(generalId, `zdravo @[Kolega](${mentioned})`)
    expect(await rungFor(mentioned)).toEqual([messageId])

    const late = await makeUser('Kasno Pomenuti', 'claims_view')
    await container.chatService.editMessage(
      messageId,
      `zdravo @[Kolega](${mentioned}) i @[Kasni](${late})`,
      author,
    )

    // The new name hears it; the old one does not hear the same message a second time.
    expect(await rungFor(late)).toEqual([messageId])
    expect(await rungFor(mentioned)).toEqual([messageId])
  })

  it('runs a mention-adding correction through the conversation fence before deletion', async () => {
    const messageId = await send(threadId, 'bez pomena')
    const sharedCalls: string[] = []
    const shared = container.chatConversationFence.shared.bind(container.chatConversationFence)
    container.chatConversationFence.shared = (conversationId, work) => {
      sharedCalls.push(conversationId)
      return shared(conversationId, work)
    }

    await container.chatService.editMessage(messageId, `sada zovem @[Kolegu](${mentioned})`, author)

    expect(sharedCalls).toEqual([threadId])
    expect(await rungFor(mentioned)).toEqual([messageId])

    await container.chatService.deleteConversation(threadId, {
      ...author,
      roles: ['admin'],
    })
    expect(await rungFor(mentioned)).toEqual([])
  })

  it('rings through a muted conversation — a mention is what mute does not silence', async () => {
    const mutedActor: ChatActor = {
      id: mentioned,
      permissions: CLAIM_READER_PERMISSIONS,
      roles: ['operator'],
    }
    await container.chatService.mute(generalId, mutedActor)

    const messageId = await send(generalId, `@[Kolega](${mentioned}) hitno`)

    expect(await rungFor(mentioned)).toEqual([messageId])
  })

  it('writes the row the bell can read: the type, the message, and who wrote it', async () => {
    const messageId = await send(generalId, `@[Kolega](${mentioned}) pogledaj nalaz`)

    const [row] = await ctx.db
      .select({
        type: schema.notifications.type,
        entityType: schema.notifications.entityType,
        entityId: schema.notifications.entityId,
        data: schema.notifications.data,
      })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, mentioned))

    expect(row?.type).toBe(NotificationType.ChatMention)
    expect(row?.entityType).toBe(NotificationEntityType.ChatMessage)
    expect(row?.entityId).toBe(messageId)
    expect(row?.data).toMatchObject({
      authorName: 'Pisac Poruke',
      conversationId: generalId,
      // The markup never reaches a person: the bell repeats words, not `@[Ime](uuid)`.
      excerpt: '@Kolega pogledaj nalaz',
    })
  })

  it('says nothing at all when a message names nobody', async () => {
    await send(generalId, 'obična poruka bez pomena')

    expect(await rungFor(mentioned)).toEqual([])
  })
})
