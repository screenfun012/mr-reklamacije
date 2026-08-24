import { schema } from '@mr/db'
import { ChatConversationType, type Permission } from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { ChatActor } from '../chat.validators.js'

const OFFICE = [
  'emotive_claims.view',
  'domace_claims.view',
] as const satisfies readonly Permission[]
const OTHER_USER_ID = '00000000-0000-4000-8000-0000000000fd'

const MAKER: ChatActor = { id: TEST_USER_ID, permissions: [...OFFICE], roles: ['operator'] }
const STRANGER: ChatActor = { id: OTHER_USER_ID, permissions: [...OFFICE], roles: ['operator'] }
const ADMIN: ChatActor = { id: OTHER_USER_ID, permissions: [...OFFICE], roles: ['admin'] }

describe('Channels', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    await ensureTestUser(ctx.db)
    await ensureTestUser(ctx.db, OTHER_USER_ID)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  /**
   * The one that would have been missed.
   *
   * A channel is visible to its MEMBERS, so a maker who is not one has built a room that vanished
   * the moment it was made — invisible to everybody including themselves, and impossible to delete.
   */
  it('puts the maker inside the room they just made', async () => {
    const channel = await container.chatService.createChannel('Nabavka', MAKER)

    // On the wire a room is named by its  — a thread is titled by its claim, a channel by
    // the name somebody typed.
    expect(channel.title).toBe('Nabavka')

    const list = await container.chatService.listConversations(MAKER)
    expect(list.items.map((item) => item.id)).toContain(channel.id)
  })

  it('keeps a channel to the people in it', async () => {
    const channel = await container.chatService.createChannel('Nabavka', MAKER)

    const list = await container.chatService.listConversations(STRANGER)
    expect(list.items.map((item) => item.id)).not.toContain(channel.id)
  })

  /**
   * Anybody may leave any room, so a channel can end up with nobody in it — and then it is visible
   * to NOBODY: it cannot be opened, cannot be deleted, and sits in the database forever.
   *
   * ⚠ An admin sees an EMPTY one, and nothing more. „An admin sees every channel" would be a
   * different feature and a different privacy.
   */
  it('shows an emptied channel to an admin, so it is not orphaned', async () => {
    const channel = await container.chatService.createChannel('Napuštena', MAKER)
    await container.chatService.removeMember(channel.id, TEST_USER_ID, MAKER)

    const forAdmin = await container.chatService.listConversations(ADMIN)
    expect(forAdmin.items.map((item) => item.id)).toContain(channel.id)

    const forStranger = await container.chatService.listConversations(STRANGER)
    expect(forStranger.items.map((item) => item.id)).not.toContain(channel.id)
  })

  it('keeps a channel that still has somebody in it private, admin or not', async () => {
    const channel = await container.chatService.createChannel('Privatna', MAKER)

    const forAdmin = await container.chatService.listConversations(ADMIN)
    // The admin is not in this room, and somebody is — so it stays theirs.
    expect(forAdmin.items.map((item) => item.id)).not.toContain(channel.id)
  })

  it('adds people, and then they see it', async () => {
    const channel = await container.chatService.createChannel('Nabavka', MAKER)
    await container.chatService.addMembers(channel.id, [OTHER_USER_ID], MAKER)

    const list = await container.chatService.listConversations(STRANGER)
    expect(list.items.map((item) => item.id)).toContain(channel.id)
  })

  it('refuses somebody else the run of a room they did not make', async () => {
    const channel = await container.chatService.createChannel('Nabavka', MAKER)
    await container.chatService.addMembers(channel.id, [OTHER_USER_ID], MAKER)

    // He is in the room, so its existence is no secret — 403, not 404.
    await expect(
      container.chatService.addMembers(channel.id, [TEST_USER_ID], STRANGER),
    ).rejects.toThrow(/managed by whoever made it/)
    await expect(container.chatService.renameChannel(channel.id, 'Moje', STRANGER)).rejects.toThrow(
      /managed by whoever made it/,
    )
  })

  it('lets an admin run any channel they can see', async () => {
    const channel = await container.chatService.createChannel('Nabavka', MAKER)
    await container.chatService.addMembers(channel.id, [OTHER_USER_ID], MAKER)

    const renamed = await container.chatService.renameChannel(channel.id, 'Nabavka i servis', ADMIN)
    expect(renamed.title).toBe('Nabavka i servis')
  })

  it('lets anybody walk out on their own, without owning the room', async () => {
    const channel = await container.chatService.createChannel('Nabavka', MAKER)
    await container.chatService.addMembers(channel.id, [OTHER_USER_ID], MAKER)

    await container.chatService.removeMember(channel.id, OTHER_USER_ID, STRANGER)

    const rows = await ctx.db
      .select({ userId: schema.chatMembers.userId })
      .from(schema.chatMembers)
      .where(
        and(
          eq(schema.chatMembers.conversationId, channel.id),
          eq(schema.chatMembers.userId, OTHER_USER_ID),
        ),
      )
    expect(rows).toHaveLength(0)
  })

  /** ⚠ On EVERY channel route, not only on delete: it is the one room that exists for everybody. */
  it('will not let anybody manage the general channel', async () => {
    const [general] = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.type, ChatConversationType.General))
      .limit(1)
    const generalId =
      general?.id ??
      (
        await ctx.db
          .insert(schema.chatConversations)
          .values({ type: ChatConversationType.General, name: 'Opšti kanal' })
          .returning({ id: schema.chatConversations.id })
      )[0]?.id ??
      ''

    await expect(container.chatService.renameChannel(generalId, 'Nešto', ADMIN)).rejects.toThrow(
      /general channel is not managed/,
    )
    await expect(
      container.chatService.addMembers(generalId, [TEST_USER_ID], ADMIN),
    ).rejects.toThrow(/general channel is not managed/)
  })

  /**
   * ⚠ Its own query. `listPeopleFor` answers "who may a mention name here", and for a channel that
   * is its members — so reusing it would offer only the people already inside.
   */
  it('offers the people who are NOT in the room yet', async () => {
    const channel = await container.chatService.createChannel('Nabavka', MAKER)

    const { members, addable } = await container.chatService.listMembers(channel.id, MAKER)

    expect(members.map((person) => person.id)).toEqual([TEST_USER_ID])
    expect(addable.map((person) => person.id)).not.toContain(TEST_USER_ID)
  })
})
