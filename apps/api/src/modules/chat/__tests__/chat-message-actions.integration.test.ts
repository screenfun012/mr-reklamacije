import { schema } from '@mr/db'
import {
  CHAT_EDIT_WINDOW_MS,
  CHAT_PINS_MAX,
  ChatConversationType,
  ChatMessageSchema,
  ChatSystemKind,
  SYSTEM_ROLE_ADMIN,
  type Permission,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableEntityError,
} from '../../../core/errors/domain-errors.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer, createChatTestApp, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { ChatActor } from '../chat.validators.js'

const CLAIM_READER_PERMISSIONS = [
  'emotive_claims.view',
  'domace_claims.view',
] as const satisfies readonly Permission[]

/** In the internal app, but claims are not his — a claim thread is absent for him, not forbidden. */
const SERVISER_PERMISSIONS = ['intake_orders.view'] as const satisfies readonly Permission[]

const OTHER_USER_ID = '00000000-0000-4000-8000-0000000000ff'
const ADMIN_USER_ID = '00000000-0000-4000-8000-0000000000ad'

const ME: ChatActor = {
  id: TEST_USER_ID,
  permissions: CLAIM_READER_PERMISSIONS,
  roles: ['operator'],
}
const OTHER: ChatActor = {
  id: OTHER_USER_ID,
  permissions: CLAIM_READER_PERMISSIONS,
  roles: ['operator'],
}
const ADMIN: ChatActor = {
  id: ADMIN_USER_ID,
  permissions: CLAIM_READER_PERMISSIONS,
  roles: [SYSTEM_ROLE_ADMIN],
}

describe('Chat message actions', () => {
  let ctx: TestDbContext
  let container: Container
  let generalId: string
  let emotiveThreadId: string

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    await ensureTestUser(ctx.db)
    await ensureTestUser(ctx.db, OTHER_USER_ID)
    await ensureTestUser(ctx.db, ADMIN_USER_ID)

    const [general] = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.type, ChatConversationType.General))
      .limit(1)
    if (general === undefined) {
      throw new Error('No general channel — run db:seed')
    }
    generalId = general.id

    const [manufacturer] = await ctx.db
      .insert(schema.engineManufacturers)
      .values({ code: 'ACT-MFG', name: 'Actions Mfg' })
      .returning({ id: schema.engineManufacturers.id })
    const [engineType] = await ctx.db
      .insert(schema.engineTypes)
      .values({ code: 'ACT-ENG', manufacturerId: manufacturer?.id ?? '' })
      .returning({ id: schema.engineTypes.id })
    const [claim] = await ctx.db
      .insert(schema.emotiveClaims)
      .values({
        warrantyReport: 'Nit za radnje nad porukom',
        engineTypeId: engineType?.id ?? '',
        dateOfClaim: new Date('2026-08-01'),
        mrNumber: 'MR-ACT-1',
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
    emotiveThreadId = thread?.id ?? ''
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  /**
   * ⚠ `created_at` is written by the DATABASE, and the test runs inside one transaction where
   * `now()` is frozen for its whole life — `vi.setSystemTime` moves the JS clock and cannot touch
   * it. So an old message is written OLD, rather than pretending the clock moved.
   */
  async function insertMessage(
    conversationId: string,
    body: string,
    authorId: string | null = TEST_USER_ID,
    ageMs = 0,
  ): Promise<string> {
    const [row] = await ctx.db
      .insert(schema.chatMessages)
      .values({
        conversationId,
        clientMsgId: crypto.randomUUID(),
        authorId,
        body,
        ...(ageMs > 0 ? { createdAt: new Date(Date.now() - ageMs) } : {}),
        ...(authorId === null ? { systemKind: ChatSystemKind.OutcomeChanged } : {}),
      })
      .returning({ id: schema.chatMessages.id })

    return row?.id ?? ''
  }

  async function bodyOnTheWire(messageId: string): Promise<string | undefined> {
    const page = await container.chatService.listMessages(generalId, { limit: 100 }, ME)
    return page.items.find((item) => item.id === messageId)?.body
  }

  describe('edit', () => {
    it('corrects my own message and stamps when it was corrected', async () => {
      const id = await insertMessage(generalId, 'prva verzja')

      const edited = await container.chatService.editMessage(id, 'prva verzija', ME)

      expect(edited.body).toBe('prva verzija')
      expect(edited.editedAt).not.toBeNull()
      expect(await bodyOnTheWire(id)).toBe('prva verzija')
    })

    it('refuses to edit somebody else’s message', async () => {
      const id = await insertMessage(generalId, 'tuđa poruka', OTHER_USER_ID)

      await expect(
        container.chatService.editMessage(id, 'prepravljeno', ME),
      ).rejects.toBeInstanceOf(ForbiddenError)
      expect(await bodyOnTheWire(id)).toBe('tuđa poruka')
    })

    it('refuses an edit after the window has closed', async () => {
      const id = await insertMessage(
        generalId,
        'stara poruka',
        TEST_USER_ID,
        CHAT_EDIT_WINDOW_MS + 1000,
      )

      await expect(container.chatService.editMessage(id, 'kasno', ME)).rejects.toBeInstanceOf(
        UnprocessableEntityError,
      )
      expect(await bodyOnTheWire(id)).toBe('stara poruka')
    })

    it('never edits a system message — it is a record, not somebody talking', async () => {
      const id = await insertMessage(generalId, '', null)

      await expect(container.chatService.editMessage(id, 'prepravka', ME)).rejects.toBeInstanceOf(
        ForbiddenError,
      )
    })

    it('404s a message in a conversation the actor may not see', async () => {
      const id = await insertMessage(emotiveThreadId, 'interno')
      const serviser: ChatActor = {
        id: TEST_USER_ID,
        permissions: SERVISER_PERMISSIONS,
        roles: ['serviser'],
      }

      await expect(
        container.chatService.editMessage(id, 'ne bih smeo', serviser),
      ).rejects.toBeInstanceOf(NotFoundError)
    })
  })

  describe('delete', () => {
    it('takes the words back without taking the row', async () => {
      const id = await insertMessage(generalId, 'ovo nisam smeo da napišem')

      await container.chatService.deleteMessage(id, ME)

      // The row is evidence and stays; the words stop travelling.
      const [row] = await ctx.db
        .select({ id: schema.chatMessages.id, deletedAt: schema.chatMessages.deletedAt })
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.id, id))
      expect(row?.id).toBe(id)
      expect(row?.deletedAt).not.toBeNull()
      expect(await bodyOnTheWire(id)).toBe('')
    })

    it('refuses to delete somebody else’s message', async () => {
      const id = await insertMessage(generalId, 'tuđa poruka', OTHER_USER_ID)

      await expect(container.chatService.deleteMessage(id, ME)).rejects.toBeInstanceOf(
        ForbiddenError,
      )
      expect(await bodyOnTheWire(id)).toBe('tuđa poruka')
    })

    it('refuses to edit a message that was already taken back', async () => {
      const id = await insertMessage(generalId, 'povučeno')
      await container.chatService.deleteMessage(id, ME)

      await expect(container.chatService.editMessage(id, 'vraćam reči', ME)).rejects.toBeInstanceOf(
        UnprocessableEntityError,
      )
      expect(await bodyOnTheWire(id)).toBe('')
    })
  })

  describe('mute', () => {
    async function isMuted(conversationId: string, actor: ChatActor): Promise<boolean> {
      const list = await container.chatService.listConversations(actor)
      return list.items.find((item) => item.id === conversationId)?.isMuted ?? false
    }

    it('mutes and unmutes per account, and says the same thing twice without complaining', async () => {
      await container.chatService.mute(generalId, ME)
      await container.chatService.mute(generalId, ME)
      expect(await isMuted(generalId, ME)).toBe(true)
      // Per ACCOUNT: muting mine says nothing about anybody else's sidebar.
      expect(await isMuted(generalId, OTHER)).toBe(false)

      await container.chatService.unmute(generalId, ME)
      await container.chatService.unmute(generalId, ME)
      expect(await isMuted(generalId, ME)).toBe(false)
    })

    it('404s a conversation the actor may not see', async () => {
      const serviser: ChatActor = {
        id: TEST_USER_ID,
        permissions: SERVISER_PERMISSIONS,
        roles: ['serviser'],
      }

      await expect(container.chatService.mute(emotiveThreadId, serviser)).rejects.toBeInstanceOf(
        NotFoundError,
      )
    })
  })

  describe('pin', () => {
    async function pinnedCount(conversationId: string): Promise<number> {
      const rows = await ctx.db
        .select({ messageId: schema.chatPins.messageId })
        .from(schema.chatPins)
        .where(eq(schema.chatPins.conversationId, conversationId))

      return rows.length
    }

    it('pins once however many times it is asked', async () => {
      const id = await insertMessage(generalId, 'važno')

      await container.chatService.pin(id, ME)
      await container.chatService.pin(id, ME)

      expect(await pinnedCount(generalId)).toBe(1)
    })

    it('refuses the pin over the cap — a shortlist is not a second inbox', async () => {
      for (let i = 0; i < CHAT_PINS_MAX; i += 1) {
        const id = await insertMessage(generalId, `važno ${String(i)}`)
        await container.chatService.pin(id, ME)
      }
      const overflow = await insertMessage(generalId, 'jedna previše')

      await expect(container.chatService.pin(overflow, ME)).rejects.toBeInstanceOf(ConflictError)
      expect(await pinnedCount(generalId)).toBe(CHAT_PINS_MAX)
    })

    it('lets the one who pinned it, or an admin, unpin it — and nobody else', async () => {
      const id = await insertMessage(generalId, 'zakačeno')
      await container.chatService.pin(id, ME)

      await expect(container.chatService.unpin(id, OTHER)).rejects.toBeInstanceOf(ForbiddenError)
      expect(await pinnedCount(generalId)).toBe(1)

      await container.chatService.unpin(id, ME)
      expect(await pinnedCount(generalId)).toBe(0)

      await container.chatService.pin(id, ME)
      await container.chatService.unpin(id, ADMIN)
      expect(await pinnedCount(generalId)).toBe(0)
    })

    it('unpins what is not pinned without complaining', async () => {
      const id = await insertMessage(generalId, 'nikad zakačeno')

      await expect(container.chatService.unpin(id, ME)).resolves.toBeUndefined()
    })
  })

  describe('reaction', () => {
    async function reactionOf(messageId: string, actor: ChatActor): Promise<[number, boolean]> {
      const page = await container.chatService.listMessages(generalId, { limit: 100 }, actor)
      const message = page.items.find((item) => item.id === messageId)
      return [message?.reactionCount ?? -1, message?.reactedByMe ?? false]
    }

    it('gives one tick per person, and the second tick is the same tick', async () => {
      const id = await insertMessage(generalId, 'slažem se?')

      await container.chatService.react(id, ME)
      await container.chatService.react(id, ME)
      expect(await reactionOf(id, ME)).toEqual([1, true])

      await container.chatService.react(id, OTHER)
      expect(await reactionOf(id, ME)).toEqual([2, true])
      expect(await reactionOf(id, OTHER)).toEqual([2, true])
    })

    it('takes the tick back, twice if asked twice', async () => {
      const id = await insertMessage(generalId, 'slažem se?')
      await container.chatService.react(id, ME)

      await container.chatService.unreact(id, ME)
      await container.chatService.unreact(id, ME)

      expect(await reactionOf(id, ME)).toEqual([0, false])
    })
  })

  describe('over the wire', () => {
    function app(permissions: readonly Permission[], roles: string[] = ['operator']) {
      return createChatTestApp(container, testUser([...permissions], TEST_USER_ID, roles))
    }

    it('answers each action with the status the client is promised', async () => {
      const reader = app(CLAIM_READER_PERMISSIONS)
      const id = await insertMessage(generalId, 'preko žice')

      const edited = await reader.request(`/api/chat/messages/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: 'preko žice, ispravljeno' }),
      })
      expect(edited.status).toBe(200)
      expect(ChatMessageSchema.parse(await edited.json()).body).toBe('preko žice, ispravljeno')

      expect(
        (await reader.request(`/api/chat/messages/${id}/pin`, { method: 'POST' })).status,
      ).toBe(204)
      expect(
        (await reader.request(`/api/chat/messages/${id}/pin`, { method: 'DELETE' })).status,
      ).toBe(204)
      expect(
        (await reader.request(`/api/chat/messages/${id}/reaction`, { method: 'POST' })).status,
      ).toBe(204)
      expect(
        (await reader.request(`/api/chat/messages/${id}/reaction`, { method: 'DELETE' })).status,
      ).toBe(204)
      expect(
        (await reader.request(`/api/chat/conversations/${generalId}/mute`, { method: 'POST' }))
          .status,
      ).toBe(204)
      expect(
        (await reader.request(`/api/chat/conversations/${generalId}/mute`, { method: 'DELETE' }))
          .status,
      ).toBe(204)
      expect((await reader.request(`/api/chat/messages/${id}`, { method: 'DELETE' })).status).toBe(
        204,
      )
    })

    it('404s every action on a conversation the actor may not see, and never 403', async () => {
      const id = await insertMessage(emotiveThreadId, 'interno')
      const serviser = app(SERVISER_PERMISSIONS, ['serviser'])

      expect(
        (await serviser.request(`/api/chat/messages/${id}`, { method: 'DELETE' })).status,
      ).toBe(404)
      expect(
        (await serviser.request(`/api/chat/messages/${id}/pin`, { method: 'POST' })).status,
      ).toBe(404)
      expect(
        (await serviser.request(`/api/chat/messages/${id}/reaction`, { method: 'POST' })).status,
      ).toBe(404)
      expect(
        (
          await serviser.request(`/api/chat/conversations/${emotiveThreadId}/mute`, {
            method: 'POST',
          })
        ).status,
      ).toBe(404)
    })

    it('refuses a portal client at the door — view_own_customer opens nothing internal', async () => {
      const id = await insertMessage(generalId, 'interno')
      const client = app(['emotive_claims.view_own_customer'] as const, ['client'])

      expect((await client.request(`/api/chat/messages/${id}`, { method: 'DELETE' })).status).toBe(
        403,
      )
    })

    it('refuses a pin over the cap with 409', async () => {
      const reader = app(CLAIM_READER_PERMISSIONS)
      for (let i = 0; i < CHAT_PINS_MAX; i += 1) {
        const id = await insertMessage(generalId, `važno ${String(i)}`)
        await container.chatService.pin(id, ME)
      }
      const overflow = await insertMessage(generalId, 'jedna previše')

      const res = await reader.request(`/api/chat/messages/${overflow}/pin`, { method: 'POST' })
      expect(res.status).toBe(409)
    })
  })
})
