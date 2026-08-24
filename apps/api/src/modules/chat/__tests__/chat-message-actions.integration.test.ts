import { schema } from '@mr/db'
import {
  CHAT_EDIT_WINDOW_MS,
  CHAT_PINS_MAX,
  ChatConversationType,
  ChatMessageSchema,
  ChatPinsResponseSchema,
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

  let bus: RecordingEventBus
  beforeEach(async () => {
    ctx = await createTestDbContext()
    bus = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, bus)
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

    /**
     * Taking a message back has to reach the OTHER screens, and until 2026-08-24 it did not.
     *
     * Every other action here announces — sending, pinning, unpinning, liking, unliking — and the
     * withdrawal was the one that did not. So a thumbs-up travelled to all fifty browsers while
     * taking back a photo sent to the wrong room travelled to none: it stayed on everybody's screen
     * until they navigated away, and permanently once the room moved past the twenty-row recovery
     * window. The server was right all along; only the screens were wrong.
     */
    it('tells the other screens, so the message really does go away', async () => {
      const id = await insertMessage(generalId, 'pogrešna soba')
      const before = bus.chatEvents.length

      await container.chatService.deleteMessage(id, ME)

      expect(bus.chatEvents.slice(before)).toHaveLength(1)
      expect(bus.chatEvents.at(-1)?.conversationId).toBe(generalId)
    })

    it('tells them about a correction too', async () => {
      const id = await insertMessage(generalId, 'prvo')
      const before = bus.chatEvents.length

      await container.chatService.editMessage(id, 'ispravljeno', ME)

      // A correction nobody else sees is not a correction.
      expect(bus.chatEvents.slice(before)).toHaveLength(1)
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

    it('reads the shortlist back with who said it, who pinned it, and the first words', async () => {
      const id = await insertMessage(generalId, 'Zapisnik obavezan pre slanja partneru')
      await container.chatService.pin(id, ME)

      const [pin, ...rest] = await container.chatService.listPins(generalId, ME)

      expect(rest).toHaveLength(0)
      expect(pin).toMatchObject({
        id,
        excerpt: 'Zapisnik obavezan pre slanja partneru',
        isDeleted: false,
        pinnedBy: ME.id,
      })
      // The author is read at read time, like everywhere else — never stored on the pin.
      expect(pin?.authorName).not.toBe('')
    })

    it('keeps a withdrawn message on the shortlist and lets none of its words out', async () => {
      const id = await insertMessage(generalId, 'ovo se povlači')
      await container.chatService.pin(id, ME)
      await container.chatService.deleteMessage(id, ME)

      const [pin] = await container.chatService.listPins(generalId, ME)

      expect(pin).toMatchObject({ id, excerpt: '', isDeleted: true })
    })

    it('refuses the shortlist of a room the actor may not see — 404, never 403', async () => {
      const serviser: ChatActor = {
        id: OTHER_USER_ID,
        permissions: SERVISER_PERMISSIONS,
        roles: ['serviser'],
      }

      await expect(
        container.chatService.listPins(emotiveThreadId, serviser),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    /**
     * ⚠ A pin and a tick create no message, and they still have to reach the other desks. They
     * publish the SAME signal a message does, because the only thing any listener does with it is
     * re-read the room. Without this the screen next door keeps showing yesterday's count until
     * somebody happens to say something.
     */
    it('tells the other desks — a tick and a pin publish, both ways', async () => {
      const bus = container.eventBus as RecordingEventBus
      const id = await insertMessage(generalId, 'javi signal')
      const before = bus.chatEvents.length

      await container.chatService.react(id, ME)
      await container.chatService.unreact(id, ME)
      await container.chatService.pin(id, ME)
      await container.chatService.unpin(id, ME)

      expect(bus.chatEvents.slice(before)).toHaveLength(4)
      expect(
        bus.chatEvents.slice(before).every((event) => event.conversationId === generalId),
      ).toBe(true)
    })
  })

  describe('reaction', () => {
    async function reactionOf(messageId: string, actor: ChatActor): Promise<[number, boolean]> {
      const page = await container.chatService.listMessages(generalId, { limit: 100 }, actor)
      const message = page.items.find((item) => item.id === messageId)
      const liked = message?.reactedBy ?? []
      return [liked.length, liked.some((person) => person.id === actor.id)]
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

    /**
     * ⚠ The names, not a count — that is the whole reason this replaced two scalar sub-selects.
     * The fixture users are renamed here on purpose: `ensureTestUser` gives every account the same
     * name, so an assertion on names alone would pass against a repository returning either of
     * them twice.
     *
     * ⚠ Compared as a SET. `now()` is frozen for the test transaction's whole life, so both rows
     * carry the same timestamp and no order can be proven here — asserting one would be a claim
     * the test cannot keep (mutation-checked: reversing the sort changed nothing).
     */
    it('names everybody who liked it, and the same person only once', async () => {
      await ctx.db
        .update(schema.users)
        .set({ name: 'Marko Petrović' })
        .where(eq(schema.users.id, ME.id))
      await ctx.db
        .update(schema.users)
        .set({ name: 'Slavko Jović' })
        .where(eq(schema.users.id, OTHER.id))
      const id = await insertMessage(generalId, 'slažem se?')

      await container.chatService.react(id, ME)
      await container.chatService.react(id, OTHER)
      await container.chatService.react(id, ME)

      const page = await container.chatService.listMessages(generalId, { limit: 100 }, ME)
      const liked = [...(page.items.find((item) => item.id === id)?.reactedBy ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name),
      )
      expect(liked).toEqual([
        { id: ME.id, name: 'Marko Petrović' },
        { id: OTHER.id, name: 'Slavko Jović' },
      ])
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

    it('serves the shortlist over the wire, and hides its existence from whoever may not read it', async () => {
      const id = await insertMessage(generalId, 'preko žice zakačeno')
      await container.chatService.pin(id, ME)

      const reader = app(CLAIM_READER_PERMISSIONS)
      const res = await reader.request(`/api/chat/conversations/${generalId}/pins`)
      expect(res.status).toBe(200)
      expect(ChatPinsResponseSchema.parse(await res.json()).items).toHaveLength(1)

      const serviser = app(SERVISER_PERMISSIONS, ['serviser'])
      expect(
        (await serviser.request(`/api/chat/conversations/${emotiveThreadId}/pins`)).status,
      ).toBe(404)
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
