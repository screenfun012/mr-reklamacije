import { schema } from '@mr/db'
import {
  ChatChannelManagementListResponseSchema,
  ChatConversationListItemSchema,
  ChatConversationType,
  ChatMembersResponseSchema,
  ChatSystemKind,
  INTERNAL_APP_PERMISSIONS,
  type Permission,
} from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Container } from '../../../core/container.js'
import { NotFoundError } from '../../../core/errors/domain-errors.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer, createChatTestApp, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { ChatActor } from '../chat.validators.js'

const OFFICE = [
  'emotive_claims.view',
  'domace_claims.view',
] as const satisfies readonly Permission[]
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002'
const THIRD_USER_ID = '00000000-0000-4000-8000-000000000003'
const ADMIN_USER_ID = '00000000-0000-4000-8000-000000000004'
const CANDIDATE_USER_ID = '00000000-0000-4000-8000-000000000005'
const INVALID_USER_ID = '00000000-0000-4000-8000-000000000006'

interface TestActor extends ChatActor {
  permissions: readonly Permission[]
}

const MAKER: TestActor = { id: TEST_USER_ID, permissions: OFFICE, roles: ['operator'] }
const MEMBER: TestActor = { id: OTHER_USER_ID, permissions: OFFICE, roles: ['operator'] }
const ADMIN: TestActor = { id: ADMIN_USER_ID, permissions: OFFICE, roles: ['admin'] }

describe('Channels', () => {
  let ctx: TestDbContext
  let container: Container
  let bus: RecordingEventBus

  beforeEach(async () => {
    ctx = await createTestDbContext()
    bus = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, bus)

    for (const id of [TEST_USER_ID, OTHER_USER_ID, THIRD_USER_ID, ADMIN_USER_ID]) {
      await ensureTestUser(ctx.db, id)
      await ctx.db
        .update(schema.users)
        .set({ isActive: true, accountStatus: 'approved', deletedAt: null })
        .where(eq(schema.users.id, id))
    }

    const operatorRoleId = await roleId('operator')
    const adminRoleId = await roleId('admin')
    await ctx.db
      .insert(schema.userRoles)
      .values([
        { userId: TEST_USER_ID, roleId: operatorRoleId, assignedBy: TEST_USER_ID },
        { userId: OTHER_USER_ID, roleId: operatorRoleId, assignedBy: TEST_USER_ID },
        { userId: THIRD_USER_ID, roleId: operatorRoleId, assignedBy: TEST_USER_ID },
        { userId: ADMIN_USER_ID, roleId: adminRoleId, assignedBy: TEST_USER_ID },
      ])
      .onConflictDoNothing()
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  function appFor(actor: TestActor) {
    return createChatTestApp(
      container,
      testUser([...actor.permissions], actor.id, [...actor.roles]),
    )
  }

  async function roleId(code: string): Promise<string> {
    const [role] = await ctx.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(eq(schema.roles.code, code))
      .limit(1)
    if (role === undefined) {
      throw new Error(`role ${code} missing from seed`)
    }
    return role.id
  }

  async function createRole(
    code: string,
    permissions: readonly Permission[],
    deletedAt: Date | null = null,
  ): Promise<string> {
    const [role] = await ctx.db
      .insert(schema.roles)
      .values({ code, nameSr: code, nameEn: code, isSystem: false, deletedAt })
      .returning({ id: schema.roles.id })
    if (role === undefined) {
      throw new Error(`role ${code} could not be created`)
    }
    if (permissions.length > 0) {
      await ctx.db
        .insert(schema.rolePermissions)
        .values(permissions.map((permissionId) => ({ roleId: role.id, permissionId })))
    }
    return role.id
  }

  async function createCandidate(
    id: string,
    roleCode: string,
    options: {
      permissions?: readonly Permission[]
      isActive?: boolean
      accountStatus?: 'pending' | 'approved' | 'rejected'
      deletedAt?: Date | null
      roleDeletedAt?: Date | null
    } = {},
  ): Promise<void> {
    await ensureTestUser(ctx.db, id)
    await ctx.db
      .update(schema.users)
      .set({
        isActive: options.isActive ?? true,
        accountStatus: options.accountStatus ?? 'approved',
        deletedAt: options.deletedAt ?? null,
      })
      .where(eq(schema.users.id, id))

    const role =
      options.permissions === undefined && options.roleDeletedAt === undefined
        ? await roleId(roleCode)
        : await createRole(roleCode, options.permissions ?? [], options.roleDeletedAt ?? null)
    await ctx.db
      .insert(schema.userRoles)
      .values({ userId: id, roleId: role, assignedBy: TEST_USER_ID })
  }

  async function postChannel(
    actor: TestActor,
    name: string,
    memberIds: readonly string[],
  ): Promise<Response> {
    return appFor(actor).request('/api/chat/channels', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, memberIds }),
    })
  }

  async function createChannel(actor: TestActor, name: string, memberIds: readonly string[] = []) {
    const response = await postChannel(actor, name, memberIds)
    expect(response.status).toBe(201)
    return ChatConversationListItemSchema.parse(await response.json())
  }

  async function expectNoRowsForChannel(name: string): Promise<void> {
    const conversations = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.name, name))
    const members = await ctx.db
      .select({ id: schema.chatMembers.userId })
      .from(schema.chatMembers)
      .innerJoin(
        schema.chatConversations,
        eq(schema.chatConversations.id, schema.chatMembers.conversationId),
      )
      .where(eq(schema.chatConversations.name, name))
    const messages = await ctx.db
      .select({ id: schema.chatMessages.id })
      .from(schema.chatMessages)
      .innerJoin(
        schema.chatConversations,
        eq(schema.chatConversations.id, schema.chatMessages.conversationId),
      )
      .where(eq(schema.chatConversations.name, name))

    expect({ conversations, members, messages }).toEqual({
      conversations: [],
      members: [],
      messages: [],
    })
  }

  it('creates the channel, deduplicated roster and one system message atomically', async () => {
    const channel = await createChannel(MAKER, 'Nabavka', [
      OTHER_USER_ID,
      THIRD_USER_ID,
      OTHER_USER_ID,
      TEST_USER_ID,
    ])

    const members = await ctx.db
      .select({ userId: schema.chatMembers.userId })
      .from(schema.chatMembers)
      .where(eq(schema.chatMembers.conversationId, channel.id))
      .orderBy(schema.chatMembers.userId)
    const messages = await ctx.db
      .select({
        id: schema.chatMessages.id,
        authorId: schema.chatMessages.authorId,
        body: schema.chatMessages.body,
        systemKind: schema.chatMessages.systemKind,
        systemMeta: schema.chatMessages.systemMeta,
      })
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.conversationId, channel.id))

    expect(members.map((member) => member.userId)).toEqual(
      [TEST_USER_ID, OTHER_USER_ID, THIRD_USER_ID].sort(),
    )
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      authorId: null,
      body: '',
      systemKind: ChatSystemKind.ChannelCreated,
      systemMeta: {},
    })
    expect(bus.chatEvents).toEqual([
      { type: 'chat_message_created', conversationId: channel.id, messageId: channel.id },
    ])
  })

  it.each([
    {
      label: 'inactive account',
      setup: () => createCandidate(CANDIDATE_USER_ID, 'operator', { isActive: false }),
    },
    {
      label: 'unapproved account',
      setup: () => createCandidate(CANDIDATE_USER_ID, 'operator', { accountStatus: 'rejected' }),
    },
    {
      label: 'deleted account',
      setup: () =>
        createCandidate(CANDIDATE_USER_ID, 'operator', { deletedAt: new Date('2026-01-01') }),
    },
    {
      label: 'portal-only account',
      setup: () => createCandidate(CANDIDATE_USER_ID, 'client'),
    },
    {
      label: 'custom role without an internal permission',
      setup: () => createCandidate(CANDIDATE_USER_ID, 'external-only', { permissions: [] }),
    },
    {
      label: 'deleted custom role',
      setup: () =>
        createCandidate(CANDIDATE_USER_ID, 'old-office', {
          permissions: [INTERNAL_APP_PERMISSIONS[0]],
          roleDeletedAt: new Date('2026-01-01'),
        }),
    },
  ])('rejects an ineligible selected member: $label', async ({ setup, label }) => {
    await setup()
    const name = `Odbijeno ${label}`

    const response = await postChannel(MAKER, name, [CANDIDATE_USER_ID])

    expect(response.status).toBe(422)
    await expectNoRowsForChannel(name)
    expect(bus.chatEvents).toEqual([])
  })

  it('accepts a custom internal role and the admin bypass as selected members', async () => {
    await createCandidate(CANDIDATE_USER_ID, 'custom-statistics', {
      permissions: [INTERNAL_APP_PERMISSIONS[0]],
    })
    await ctx.db
      .delete(schema.rolePermissions)
      .where(eq(schema.rolePermissions.roleId, await roleId('admin')))

    const channel = await createChannel(MAKER, 'Prava interna', [CANDIDATE_USER_ID, ADMIN_USER_ID])
    const members = await ctx.db
      .select({ userId: schema.chatMembers.userId })
      .from(schema.chatMembers)
      .where(eq(schema.chatMembers.conversationId, channel.id))

    expect(members.map((member) => member.userId).sort()).toEqual(
      [TEST_USER_ID, CANDIDATE_USER_ID, ADMIN_USER_ID].sort(),
    )
  })

  it('uses actual internal eligibility for General people and the addable roster', async () => {
    await createCandidate(CANDIDATE_USER_ID, 'custom-intake', {
      permissions: [INTERNAL_APP_PERMISSIONS[0]],
    })
    await createCandidate(INVALID_USER_ID, 'custom-external', { permissions: [] })
    const portalId = '00000000-0000-4000-8000-000000000007'
    await createCandidate(portalId, 'client')

    const [general] = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.type, ChatConversationType.General))
      .limit(1)
    if (general === undefined) {
      throw new Error('general channel missing from seed')
    }

    const people = await container.chatService.listPeople(general.id, MAKER)
    expect(people.items.map((person) => person.id)).toContain(CANDIDATE_USER_ID)
    expect(people.items.map((person) => person.id)).toContain(ADMIN_USER_ID)
    expect(people.items.map((person) => person.id)).not.toContain(INVALID_USER_ID)
    expect(people.items.map((person) => person.id)).not.toContain(portalId)

    const channel = await createChannel(MAKER, 'Kandidati')
    const response = await appFor(MAKER).request(`/api/chat/conversations/${channel.id}/members`)
    expect(response.status).toBe(200)
    const roster = ChatMembersResponseSchema.parse(await response.json())
    expect(roster.addable.map((person) => person.id)).toContain(CANDIDATE_USER_ID)
    expect(roster.addable.map((person) => person.id)).toContain(ADMIN_USER_ID)
    expect(roster.addable.map((person) => person.id)).not.toContain(INVALID_USER_ID)
    expect(roster.addable.map((person) => person.id)).not.toContain(portalId)
  })

  it('rolls back the whole later-add batch when one selected user is ineligible', async () => {
    await createCandidate(CANDIDATE_USER_ID, 'custom-internal', {
      permissions: [INTERNAL_APP_PERMISSIONS[0]],
    })
    await createCandidate(INVALID_USER_ID, 'custom-no-entry', { permissions: [] })
    const channel = await createChannel(MAKER, 'Atomsko dodavanje')
    bus.chatEvents.length = 0

    const response = await appFor(MAKER).request(`/api/chat/conversations/${channel.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userIds: [CANDIDATE_USER_ID, INVALID_USER_ID] }),
    })

    expect(response.status).toBe(422)
    const rows = await ctx.db
      .select({ userId: schema.chatMembers.userId })
      .from(schema.chatMembers)
      .where(eq(schema.chatMembers.conversationId, channel.id))
    expect(rows.map((row) => row.userId)).toEqual([TEST_USER_ID])
    expect(bus.chatEvents).toEqual([])
  })

  it('separates metadata managers from ordinary content membership', async () => {
    const channel = await createChannel(MAKER, 'Metapodaci', [OTHER_USER_ID])

    const memberResponse = await appFor(MEMBER).request(
      `/api/chat/conversations/${channel.id}/members`,
    )
    expect(memberResponse.status).toBe(200)
    expect(ChatMembersResponseSchema.parse(await memberResponse.json())).toMatchObject({
      addable: [],
      canManage: false,
    })

    await container.chatService.removeMember(channel.id, TEST_USER_ID, MAKER)
    bus.chatEvents.length = 0

    for (const actor of [MAKER, ADMIN]) {
      const rosterResponse = await appFor(actor).request(
        `/api/chat/conversations/${channel.id}/members`,
      )
      expect(rosterResponse.status).toBe(200)
      expect(ChatMembersResponseSchema.parse(await rosterResponse.json()).canManage).toBe(true)

      await expect(
        container.chatService.listMessages(channel.id, { limit: 50 }, actor),
      ).rejects.toBeInstanceOf(NotFoundError)
      await expect(container.chatService.listAttachments(channel.id, actor)).rejects.toBeInstanceOf(
        NotFoundError,
      )
    }

    const rename = await appFor(MAKER).request(`/api/chat/conversations/${channel.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Metapodaci 2' }),
    })
    expect(rename.status).toBe(204)
    expect(bus.chatEvents).toEqual([
      { type: 'chat_message_created', conversationId: channel.id, messageId: channel.id },
    ])
  })

  it('keeps an empty legacy channel and its history hidden until a manager self-adds', async () => {
    const [legacy] = await ctx.db
      .insert(schema.chatConversations)
      .values({ type: ChatConversationType.Channel, name: 'Stari kanal', createdBy: TEST_USER_ID })
      .returning({ id: schema.chatConversations.id })
    if (legacy === undefined) {
      throw new Error('legacy channel could not be created')
    }
    await ctx.db.insert(schema.chatMessages).values({
      conversationId: legacy.id,
      clientMsgId: crypto.randomUUID(),
      authorId: TEST_USER_ID,
      body: 'Stara poruka',
    })

    for (const actor of [MAKER, ADMIN]) {
      const list = await container.chatService.listConversations(actor)
      expect(list.items.map((item) => item.id)).not.toContain(legacy.id)
      await expect(
        container.chatService.listMessages(legacy.id, { limit: 50 }, actor),
      ).rejects.toBeInstanceOf(NotFoundError)
    }

    const addSelf = await appFor(MAKER).request(`/api/chat/conversations/${legacy.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userIds: [TEST_USER_ID] }),
    })
    expect(addSelf.status).toBe(204)

    const page = await container.chatService.listMessages(legacy.id, { limit: 50 }, MAKER)
    expect(page.items.map((message) => message.body)).toEqual(['Stara poruka'])
  })

  it('returns 422 for every General metadata mutation', async () => {
    const [general] = await ctx.db
      .select({ id: schema.chatConversations.id })
      .from(schema.chatConversations)
      .where(eq(schema.chatConversations.type, ChatConversationType.General))
      .limit(1)
    if (general === undefined) {
      throw new Error('general channel missing from seed')
    }

    const responses = await Promise.all([
      appFor(ADMIN).request(`/api/chat/conversations/${general.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Drugi opšti' }),
      }),
      appFor(ADMIN).request(`/api/chat/conversations/${general.id}/members`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userIds: [TEST_USER_ID] }),
      }),
      appFor(ADMIN).request(`/api/chat/conversations/${general.id}/members/me`, {
        method: 'DELETE',
      }),
    ])

    expect(responses.map((response) => response.status)).toEqual([422, 422, 422])
    expect(bus.chatEvents).toEqual([])
  })

  it('lists only manageable named channels with search, counts and a disabled creator', async () => {
    const own = await createChannel(MAKER, 'Nabavka delova', [OTHER_USER_ID])
    const foreign = await createChannel(MEMBER, 'Servis motora')

    const ownResponse = await appFor(MAKER).request('/api/chat/channels/manage?search=Nabavka')
    expect(ownResponse.status).toBe(200)
    expect(ChatChannelManagementListResponseSchema.parse(await ownResponse.json())).toMatchObject({
      items: [{ id: own.id, name: 'Nabavka delova', memberCount: 2 }],
      total: 1,
      page: 1,
      pageSize: 50,
    })

    await ctx.db
      .update(schema.users)
      .set({ isActive: false })
      .where(eq(schema.users.id, TEST_USER_ID))

    const adminResponse = await appFor(ADMIN).request('/api/chat/channels/manage')
    expect(adminResponse.status).toBe(200)
    const adminList = ChatChannelManagementListResponseSchema.parse(await adminResponse.json())
    expect(adminList.items.map((item) => item.id)).toEqual([own.id, foreign.id])
    expect(adminList.items.find((item) => item.id === own.id)?.creatorName).toBeNull()
  })

  it('caps management pages at fifty and orders equal names by id', async () => {
    const rows = Array.from({ length: 52 }, (_, index) => ({
      id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      type: ChatConversationType.Channel,
      name: 'Isti kanal',
      createdBy: TEST_USER_ID,
    }))
    await ctx.db.insert(schema.chatConversations).values(rows)

    const messageRead = vi.spyOn(container.chatRepository, 'listMessages')
    const fileRead = vi.spyOn(container.chatRepository, 'listConversationAttachments')
    const firstResponse = await appFor(MAKER).request('/api/chat/channels/manage')
    const secondResponse = await appFor(MAKER).request('/api/chat/channels/manage?page=2')

    expect(firstResponse.status).toBe(200)
    expect(secondResponse.status).toBe(200)
    const first = ChatChannelManagementListResponseSchema.parse(await firstResponse.json())
    const second = ChatChannelManagementListResponseSchema.parse(await secondResponse.json())
    expect(first).toMatchObject({ total: 52, page: 1, pageSize: 50 })
    expect(first.items).toHaveLength(50)
    expect(second.items).toHaveLength(2)
    expect([...first.items, ...second.items].map((item) => item.id)).toEqual(
      rows.map((row) => row.id),
    )
    expect(messageRead).not.toHaveBeenCalled()
    expect(fileRead).not.toHaveBeenCalled()
  })

  it('returns 204 and exactly one id signal for rename and each successful roster write', async () => {
    const channel = await createChannel(MAKER, 'Signali')
    bus.chatEvents.length = 0

    const rename = await appFor(MAKER).request(`/api/chat/conversations/${channel.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Signali 2' }),
    })
    const add = await appFor(MAKER).request(`/api/chat/conversations/${channel.id}/members`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userIds: [OTHER_USER_ID] }),
    })
    const remove = await appFor(MAKER).request(
      `/api/chat/conversations/${channel.id}/members/${OTHER_USER_ID}`,
      { method: 'DELETE' },
    )

    expect([rename.status, add.status, remove.status]).toEqual([204, 204, 204])
    expect(bus.chatEvents).toEqual(
      Array.from({ length: 3 }, () => ({
        type: 'chat_message_created' as const,
        conversationId: channel.id,
        messageId: channel.id,
      })),
    )

    const auditRows = await ctx.db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.entityType, 'chat_conversation'),
          eq(schema.auditLog.entityId, channel.id),
        ),
      )
    expect(auditRows).toEqual([])
  })
})
