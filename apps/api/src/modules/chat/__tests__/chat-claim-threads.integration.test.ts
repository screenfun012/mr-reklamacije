import { schema } from '@mr/db'
import {
  ChatConversationListItemSchema,
  ChatConversationType,
  ChatSystemKind,
  ClaimKind,
  ClaimOutcome,
  type Permission,
} from '@mr/shared'
import { and, eq, isNull } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../../core/errors/domain-errors.js'
import {
  ensureTestUser,
  getClaimCategoryIdByCode,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer, createChatTestApp, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { ChatActor } from '../chat.validators.js'

const CLAIM_READER_PERMISSIONS = [
  'emotive_claims.view',
  'domace_claims.view',
  'emotive_claims.update',
  'emotive_claims.change_outcome',
  'domace_claims.update',
  'domace_claims.change_outcome',
] as const satisfies readonly Permission[]

const CLAIM_READER: ChatActor = {
  id: TEST_USER_ID,
  permissions: CLAIM_READER_PERMISSIONS,
  roles: ['operator'],
}

/** In the internal app, but claims are not his. A thread of theirs must be absent, not forbidden. */
const SERVISER_PERMISSIONS = ['intake_orders.view'] as const satisfies readonly Permission[]
const SERVISER: ChatActor = {
  id: TEST_USER_ID,
  permissions: SERVISER_PERMISSIONS,
  roles: ['serviser'],
}

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

/** Somebody else in the shop — a mention needs a person who is not the author. */
const OTHER_USER_ID = '00000000-0000-4000-8000-0000000000ee'

describe('Chat claim threads', () => {
  let ctx: TestDbContext
  let container: Container
  let bus: RecordingEventBus
  let emotiveClaimId: string
  let domaceClaimId: string
  let overhaulCategoryId: string
  let machiningCategoryId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    bus = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, bus)
    await ensureTestUser(ctx.db)
    await ensureTestUser(ctx.db, OTHER_USER_ID)

    overhaulCategoryId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
    machiningCategoryId = await getClaimCategoryIdByCode(ctx.db, 'MASINSKA_OBRADA')

    const [manufacturer] = await ctx.db
      .insert(schema.engineManufacturers)
      .values({ code: 'THREAD-MFG', name: 'Thread Mfg' })
      .returning({ id: schema.engineManufacturers.id })
    const [engineType] = await ctx.db
      .insert(schema.engineTypes)
      .values({ code: 'THREAD-ENG', manufacturerId: manufacturer?.id ?? '' })
      .returning({ id: schema.engineTypes.id })

    const [emotive] = await ctx.db
      .insert(schema.emotiveClaims)
      .values({
        warrantyReport: 'Nit za reklamaciju',
        engineTypeId: engineType?.id ?? '',
        dateOfClaim: new Date('2026-08-01'),
        mrNumber: 'MR-THREAD-1',
        outcome: ClaimOutcome.Pending,
        claimYear: 2026,
        categoryId: overhaulCategoryId,
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.emotiveClaims.id })
    emotiveClaimId = emotive?.id ?? ''

    const [domace] = await ctx.db
      .insert(schema.domaceClaims)
      .values({
        customerName: 'Auto Stanić',
        outcome: ClaimOutcome.Pending,
        claimYear: 2026,
        categoryId: overhaulCategoryId,
        createdBy: TEST_USER_ID,
      })
      .returning({ id: schema.domaceClaims.id })
    domaceClaimId = domace?.id ?? ''
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function systemKindsIn(conversationId: string): Promise<(string | null)[]> {
    const rows = await ctx.db
      .select({ systemKind: schema.chatMessages.systemKind })
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.conversationId, conversationId))
      .orderBy(schema.chatMessages.seq)

    return rows.map((row) => row.systemKind)
  }

  async function claimThreadCount(): Promise<number> {
    const rows = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(
        and(
          eq(schema.chatConversations.type, ChatConversationType.Claim),
          isNull(schema.chatConversations.deletedAt),
        ),
      )

    return rows.length
  }

  it('opens the same thread whatever door you come through', async () => {
    const first = await container.chatService.threadForClaim(
      ClaimKind.Emotive,
      emotiveClaimId,
      CLAIM_READER,
    )
    const second = await container.chatService.threadForClaim(
      ClaimKind.Emotive,
      emotiveClaimId,
      CLAIM_READER,
    )

    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.conversation.id).toBe(first.conversation.id)
    expect(await claimThreadCount()).toBe(1)
  })

  it('writes a thread_created system message when it opens the thread, and only then', async () => {
    const { conversation } = await container.chatService.threadForClaim(
      ClaimKind.Emotive,
      emotiveClaimId,
      CLAIM_READER,
    )
    await container.chatService.threadForClaim(ClaimKind.Emotive, emotiveClaimId, CLAIM_READER)

    expect(await systemKindsIn(conversation.id)).toEqual([ChatSystemKind.ThreadCreated])
  })

  it('opens a thread for a DOMACE claim too, named by its customer', async () => {
    const { conversation, created } = await container.chatService.threadForClaim(
      ClaimKind.Domace,
      domaceClaimId,
      CLAIM_READER,
    )

    expect(created).toBe(true)
    expect(conversation.claimKind).toBe(ClaimKind.Domace)
    expect(conversation.claimId).toBe(domaceClaimId)
  })

  it('refuses a claim the actor may not read — 404, never 403', async () => {
    await expect(
      container.chatService.threadForClaim(ClaimKind.Emotive, emotiveClaimId, SERVISER),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(await claimThreadCount()).toBe(0)
  })

  it('refuses a soft-deleted claim — there is nothing left to talk about', async () => {
    await ctx.db
      .update(schema.emotiveClaims)
      .set({ deletedAt: new Date() })
      .where(eq(schema.emotiveClaims.id, emotiveClaimId))

    await expect(
      container.chatService.threadForClaim(ClaimKind.Emotive, emotiveClaimId, CLAIM_READER),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('answers 201 the first time and 200 the next, and 404 to someone the claim is not for', async () => {
    const reader = createChatTestApp(container, testUser([...CLAIM_READER_PERMISSIONS]))
    const path = `/api/chat/claims/emotive/${emotiveClaimId}/thread`

    const first = await reader.request(path, { method: 'POST' })
    expect(first.status).toBe(201)
    const conversation = ChatConversationListItemSchema.parse(await first.json())
    expect(conversation.claimId).toBe(emotiveClaimId)

    const second = await reader.request(path, { method: 'POST' })
    expect(second.status).toBe(200)

    const serviser = createChatTestApp(container, testUser([...SERVISER_PERMISSIONS]))
    const refused = await serviser.request(path, { method: 'POST' })
    expect(refused.status).toBe(404)
  })

  it('writes a system message when the outcome changes — but only if a thread exists', async () => {
    await container.emotiveClaimsService.changeOutcome(
      emotiveClaimId,
      { outcome: ClaimOutcome.Accepted },
      CLAIM_READER,
      auditContext,
    )

    // spec §5 row 9: a system event NEVER creates a thread — nothing is made silently.
    expect(await claimThreadCount()).toBe(0)

    const { conversation } = await container.chatService.threadForClaim(
      ClaimKind.Emotive,
      emotiveClaimId,
      CLAIM_READER,
    )
    await container.emotiveClaimsService.changeOutcome(
      emotiveClaimId,
      { outcome: ClaimOutcome.Rejected },
      CLAIM_READER,
      auditContext,
    )

    expect(await systemKindsIn(conversation.id)).toEqual([
      ChatSystemKind.ThreadCreated,
      ChatSystemKind.OutcomeChanged,
    ])
  })

  it('records the publish to the client in the thread', async () => {
    const { conversation } = await container.chatService.threadForClaim(
      ClaimKind.Emotive,
      emotiveClaimId,
      CLAIM_READER,
    )

    await container.emotiveClaimsService.publish(emotiveClaimId, auditContext)
    // Publishing twice is one publish, so it is also one system message.
    await container.emotiveClaimsService.publish(emotiveClaimId, auditContext)

    expect(await systemKindsIn(conversation.id)).toEqual([
      ChatSystemKind.ThreadCreated,
      ChatSystemKind.PublishedToClient,
    ])
  })

  it('records a category change in the thread, and says nothing when the category stays', async () => {
    const { conversation } = await container.chatService.threadForClaim(
      ClaimKind.Emotive,
      emotiveClaimId,
      CLAIM_READER,
    )

    await container.emotiveClaimsService.update(
      emotiveClaimId,
      { engineCode: 'ABC-1' },
      CLAIM_READER,
      auditContext,
    )
    await container.emotiveClaimsService.update(
      emotiveClaimId,
      { categoryId: machiningCategoryId },
      CLAIM_READER,
      auditContext,
    )

    expect(await systemKindsIn(conversation.id)).toEqual([
      ChatSystemKind.ThreadCreated,
      ChatSystemKind.CategoryChanged,
    ])
  })

  it('records a DOMACE outcome change and category change in its own thread', async () => {
    const { conversation } = await container.chatService.threadForClaim(
      ClaimKind.Domace,
      domaceClaimId,
      CLAIM_READER,
    )

    await container.domaceClaimsService.changeOutcome(
      domaceClaimId,
      { outcome: ClaimOutcome.Accepted },
      CLAIM_READER,
      auditContext,
    )
    await container.domaceClaimsService.update(
      domaceClaimId,
      { categoryId: machiningCategoryId },
      CLAIM_READER,
      auditContext,
    )

    expect(await systemKindsIn(conversation.id)).toEqual([
      ChatSystemKind.ThreadCreated,
      ChatSystemKind.OutcomeChanged,
      ChatSystemKind.CategoryChanged,
    ])
  })

  it('never throws a chat failure back at the claim — the outcome change still stands', async () => {
    await container.chatService.threadForClaim(ClaimKind.Emotive, emotiveClaimId, CLAIM_READER)
    vi.spyOn(container.chatRepository, 'findClaimThreadId').mockRejectedValue(
      new Error('chat je pao'),
    )

    const updated = await container.emotiveClaimsService.changeOutcome(
      emotiveClaimId,
      { outcome: ClaimOutcome.Accepted },
      CLAIM_READER,
      auditContext,
    )

    expect(updated.outcome).toBe(ClaimOutcome.Accepted)
  })

  /**
   * Nikola, 2026-08-23: "ako je reklamacija zavrsena … ona postane arhivirana i ne moze da se pise
   * nista vise u njoj samo u samoj reklamacciji moze da se procita … ako se ponovo otvori ta nit
   * postaje ponovo aktivna".
   *
   * ⚠ No column and no switch. The thread's state IS the claim's outcome, so the two cannot drift,
   * nothing has to remember to run, and reopening the claim reopens the thread by itself.
   */
  describe('a decided claim closes its thread', () => {
    let threadId = ''

    beforeEach(async () => {
      const { conversation } = await container.chatService.threadForClaim(
        ClaimKind.Emotive,
        emotiveClaimId,
        CLAIM_READER,
      )
      threadId = conversation.id
    })

    async function decide(
      outcome: 'accepted' | 'rejected' | 'archived' | 'pending',
    ): Promise<void> {
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome })
        .where(eq(schema.emotiveClaims.id, emotiveClaimId))
    }

    it('takes the thread off the list', async () => {
      const before = await container.chatService.listConversations(CLAIM_READER)
      expect(before.items.map((item) => item.id)).toContain(threadId)

      await decide('accepted')

      const after = await container.chatService.listConversations(CLAIM_READER)
      expect(after.items.map((item) => item.id)).not.toContain(threadId)
    })

    it('still reads on the claim itself, and says it is closed', async () => {
      await decide('rejected')

      // This is the whole point: the conversation is evidence and stays readable where the claim is.
      const page = await container.chatService.listMessages(threadId, { limit: 10 }, CLAIM_READER)
      expect(page).toBeDefined()

      const { conversation } = await container.chatService.threadForClaim(
        ClaimKind.Emotive,
        emotiveClaimId,
        CLAIM_READER,
      )
      expect(conversation.isLocked).toBe(true)
    })

    it('refuses a new message', async () => {
      await decide('accepted')

      await expect(
        container.chatService.send(
          threadId,
          { clientMsgId: crypto.randomUUID(), body: 'još nešto' },
          CLAIM_READER,
        ),
      ).rejects.toBeInstanceOf(UnprocessableEntityError)
    })

    it('opens again when the claim goes back to pending', async () => {
      await decide('archived')
      await decide('pending')

      const list = await container.chatService.listConversations(CLAIM_READER)
      expect(list.items.map((item) => item.id)).toContain(threadId)

      const sent = await container.chatService.send(
        threadId,
        { clientMsgId: crypto.randomUUID(), body: 'ponovo otvoreno' },
        CLAIM_READER,
      )
      expect(sent.created).toBe(true)
    })

    it('leaves the general channel alone whatever the claims are doing', async () => {
      await decide('accepted')

      const list = await container.chatService.listConversations(CLAIM_READER)
      const general = list.items.find((item) => item.type === ChatConversationType.General)
      expect(general?.isLocked).toBe(false)
    })
  })

  /**
   * Nikola, 2026-08-23: a room made by mistake goes "kao da nikada nije bila". For a MISTAKE, not
   * for tidying history — the precedent is the intake order that was wrongly signed.
   */
  async function makeLiveUser(userId: string): Promise<void> {
    await ctx.db
      .update(schema.users)
      .set({ isActive: true, accountStatus: 'approved' })
      .where(eq(schema.users.id, userId))
  }

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

  describe('an admin erases a room made by mistake', () => {
    const ADMIN: ChatActor = { ...CLAIM_READER, roles: ['admin'] }

    async function makeThread(): Promise<string> {
      const { conversation } = await container.chatService.threadForClaim(
        ClaimKind.Emotive,
        emotiveClaimId,
        CLAIM_READER,
      )
      return conversation.id
    }

    it('takes the room and everything under it', async () => {
      const threadId = await makeThread()
      await container.chatService.send(
        threadId,
        { clientMsgId: crypto.randomUUID(), body: 'greškom' },
        CLAIM_READER,
      )

      await container.chatService.deleteConversation(threadId, ADMIN)

      const rooms = await ctx.db
        .select({ id: schema.chatConversations.id })
        .from(schema.chatConversations)
        .where(eq(schema.chatConversations.id, threadId))
      const messages = await ctx.db
        .select({ id: schema.chatMessages.id })
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.conversationId, threadId))

      expect(rooms).toEqual([])
      expect(messages).toEqual([])
    })

    it('frees the claim, so a thread can be made for it again', async () => {
      const first = await makeThread()
      await container.chatService.deleteConversation(first, ADMIN)

      const second = await makeThread()
      expect(second).not.toBe(first)
    })

    it('leaves an audit row — the only thing that says the room existed', async () => {
      const threadId = await makeThread()
      await container.chatService.send(
        threadId,
        { clientMsgId: crypto.randomUUID(), body: 'greškom' },
        CLAIM_READER,
      )

      await container.chatService.deleteConversation(threadId, ADMIN)

      const [entry] = await ctx.db
        .select({ action: schema.auditLog.action, changes: schema.auditLog.changes })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, threadId))

      expect(entry?.action).toBe('delete')
      // Two: the one written here, and the „Nit napravljena" the server writes when a thread is
      // opened. A system message is a row in the room and goes with it.
      expect(entry?.changes).toMatchObject({ messagesErased: 2 })
    })

    it('lets go of the bell entries that pointed at those messages', async () => {
      const threadId = await makeThread()
      await makeLiveUser(OTHER_USER_ID)
      await giveRole(OTHER_USER_ID, 'claims_view')
      await container.chatService.send(
        threadId,
        { clientMsgId: crypto.randomUUID(), body: `@[Kolega](${OTHER_USER_ID})` },
        CLAIM_READER,
      )
      const before = await ctx.db.select().from(schema.notifications)
      expect(before.length).toBeGreaterThan(0)

      await container.chatService.deleteConversation(threadId, ADMIN)

      // `notifications.entity_id` has no foreign key: without this they survive as bell rows
      // linking into a room that is not there.
      expect(await ctx.db.select().from(schema.notifications)).toEqual([])
    })

    it('refuses anybody who is not an admin', async () => {
      const threadId = await makeThread()

      await expect(
        container.chatService.deleteConversation(threadId, CLAIM_READER),
      ).rejects.toBeInstanceOf(ForbiddenError)
    })

    it('refuses the general channel, which every screen assumes is there', async () => {
      const [general] = await ctx.db
        .select({ id: schema.chatConversations.id })
        .from(schema.chatConversations)
        .where(eq(schema.chatConversations.type, ChatConversationType.General))
        .limit(1)

      await expect(
        container.chatService.deleteConversation(general?.id ?? '', ADMIN),
      ).rejects.toBeInstanceOf(UnprocessableEntityError)
    })
  })
})
