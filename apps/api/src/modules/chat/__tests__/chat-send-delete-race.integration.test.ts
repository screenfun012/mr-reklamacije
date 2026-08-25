import { readFile } from 'node:fs/promises'

import { createPool, schema } from '@mr/db'
import { ChatConversationType, ChatSystemKind, type Permission } from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { buildContainer, type Container } from '../../../core/container.js'
import type { ApiDatabase } from '../../../core/database.js'
import { NotFoundError } from '../../../core/errors/domain-errors.js'
import type {
  StorageService,
  UploadOpts,
} from '../../../infrastructure/storage/storage.interface.js'
import { ensureTestUser } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { createTestEnv, fakeLogger } from '../../../test-helpers/test-app.js'
import {
  PostgresChatConversationFence,
  type ChatConversationFence,
} from '../chat-conversation-fence.js'
import type { ChatActor } from '../chat.validators.js'

const OFFICE = [
  'emotive_claims.view',
  'domace_claims.view',
] as const satisfies readonly Permission[]

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('Chat send/delete fence', () => {
  let databaseUrl: string
  let pool: ReturnType<typeof createPool>
  let db: ApiDatabase
  let container: Container
  let bus: RecordingEventBus
  let conversationId: string
  let author: ChatActor
  let admin: ChatActor
  let recipientId: string
  let originalUpload: StorageService['upload']
  let mentionSignalInsideSharedCallback: boolean

  beforeEach(async () => {
    databaseUrl = process.env['TEST_DATABASE_URL'] ?? ''
    if (databaseUrl === '') {
      throw new Error('TEST_DATABASE_URL is required')
    }

    pool = createPool(databaseUrl)
    db = drizzle(pool, { schema }) as ApiDatabase
    bus = new RecordingEventBus()
    mentionSignalInsideSharedCallback = false
    let sharedCallbackActive = false
    const realFence = new PostgresChatConversationFence(pool)
    const observedFence: ChatConversationFence = {
      shared: (id, work) =>
        realFence.shared(id, async (executor) => {
          sharedCallbackActive = true
          try {
            return await work(executor)
          } finally {
            sharedCallbackActive = false
          }
        }),
      exclusive: (id, work) => realFence.exclusive(id, work),
    }
    const recordNotification = bus.publishNotificationCreated.bind(bus)
    bus.publishNotificationCreated = (userId, notificationId) => {
      mentionSignalInsideSharedCallback ||= sharedCallbackActive
      recordNotification(userId, notificationId)
    }
    container = buildContainer(
      createTestEnv(databaseUrl),
      fakeLogger(),
      db,
      pool,
      bus,
      undefined,
      undefined,
      undefined,
      observedFence,
    )

    const authorId = crypto.randomUUID()
    const adminId = crypto.randomUUID()
    recipientId = crypto.randomUUID()
    for (const id of [authorId, adminId, recipientId]) {
      await ensureTestUser(db, id)
      await db
        .update(schema.users)
        .set({ isActive: true, accountStatus: 'approved', deletedAt: null })
        .where(eq(schema.users.id, id))
    }

    author = { id: authorId, permissions: OFFICE, roles: ['operator'] }
    admin = { id: adminId, permissions: OFFICE, roles: ['admin'] }

    const [conversation] = await db
      .insert(schema.chatConversations)
      .values({
        type: ChatConversationType.Channel,
        name: 'Committed send/delete race',
        createdBy: authorId,
      })
      .returning({ id: schema.chatConversations.id })
    if (conversation === undefined) {
      throw new Error('race conversation could not be created')
    }
    conversationId = conversation.id
    await db.insert(schema.chatMembers).values([
      { conversationId, userId: authorId },
      { conversationId, userId: recipientId },
    ])
    await db.insert(schema.chatMessages).values({
      conversationId,
      clientMsgId: crypto.randomUUID(),
      authorId: null,
      body: '',
      systemKind: ChatSystemKind.ChannelCreated,
      systemMeta: {},
    })

    originalUpload = container.storageService.upload.bind(container.storageService)
  })

  afterEach(async () => {
    container.storageService.upload = originalUpload
    await db.delete(schema.auditLog).where(eq(schema.auditLog.entityId, conversationId))
    await db.delete(schema.chatConversations).where(eq(schema.chatConversations.id, conversationId))
    await db.delete(schema.users).where(eq(schema.users.id, author.id))
    await db.delete(schema.users).where(eq(schema.users.id, admin.id))
    await db.delete(schema.users).where(eq(schema.users.id, recipientId))
    await pool.end()
  })

  async function observeExclusiveWait(
    deletePromise: Promise<void>,
  ): Promise<'waiting' | 'settled' | 'timeout'> {
    let settled = false
    void deletePromise.then(
      () => {
        settled = true
      },
      () => {
        settled = true
      },
    )

    const deadline = Date.now() + 5_000
    while (Date.now() < deadline && !settled) {
      const result = await pool.query<{ waiting: boolean }>(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND wait_event_type = 'Lock'
            AND query ILIKE '%pg_advisory_lock(hashtextextended%'
        ) AS waiting
      `)
      if (result.rows[0]?.waiting === true) {
        return 'waiting'
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    return settled ? 'settled' : 'timeout'
  }

  it('lets an in-flight send finish, then erases every row and stored object before admitting no new send', async () => {
    const fixture = await readFile(
      new URL('../../../../../internal-web/public/favicon.png', import.meta.url),
    )
    const prepared = await container.chatAttachmentsService.prepare([
      { fileName: 'race.png', data: fixture, caption: null },
    ])
    const thumbnailWritten = deferred()
    const releaseSend = deferred()
    let originalPath = ''
    let thumbnailPath = ''

    container.storageService.upload = async (opts: UploadOpts) => {
      const stored = await originalUpload(opts)
      if (opts.path.includes('/_thumb/')) {
        thumbnailPath = opts.path
        thumbnailWritten.resolve()
        await releaseSend.promise
      } else {
        originalPath = opts.path
      }
      return stored
    }

    const sendPromise = container.chatService.send(
      conversationId,
      {
        clientMsgId: crypto.randomUUID(),
        body: `@[Kolega](${recipientId}) trka`,
      },
      author,
      prepared,
    )
    let deletePromise: Promise<void> | undefined

    try {
      await thumbnailWritten.promise
      expect(originalPath).not.toBe('')
      expect(thumbnailPath).not.toBe('')
      expect(await container.storageService.exists(originalPath)).toBe(true)
      expect(await container.storageService.exists(thumbnailPath)).toBe(true)

      deletePromise = container.chatService.deleteConversation(conversationId, admin)
      expect(await observeExclusiveWait(deletePromise)).toBe('waiting')

      releaseSend.resolve()
      const sent = await sendPromise
      expect(sent.created).toBe(true)
      await deletePromise

      expect(bus.notificationEvents).toHaveLength(1)
      expect(mentionSignalInsideSharedCallback).toBe(false)
      expect(
        bus.chatEvents.filter(
          (event) => event.conversationId === conversationId && event.messageId === conversationId,
        ),
      ).toHaveLength(1)
      expect(await container.storageService.exists(originalPath)).toBe(false)
      expect(await container.storageService.exists(thumbnailPath)).toBe(false)

      const [conversations, messages, attachments, notifications, audits] = await Promise.all([
        db
          .select({ id: schema.chatConversations.id })
          .from(schema.chatConversations)
          .where(eq(schema.chatConversations.id, conversationId)),
        db
          .select({ id: schema.chatMessages.id })
          .from(schema.chatMessages)
          .where(eq(schema.chatMessages.conversationId, conversationId)),
        db
          .select({ id: schema.attachments.id })
          .from(schema.attachments)
          .where(eq(schema.attachments.chatMessageId, sent.message.id)),
        db
          .select({ id: schema.notifications.id })
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.entityType, 'chat_message'),
              eq(schema.notifications.entityId, sent.message.id),
            ),
          ),
        db
          .select({ action: schema.auditLog.action, changes: schema.auditLog.changes })
          .from(schema.auditLog)
          .where(eq(schema.auditLog.entityId, conversationId)),
      ])
      expect({ conversations, messages, attachments, notifications }).toEqual({
        conversations: [],
        messages: [],
        attachments: [],
        notifications: [],
      })
      expect(audits).toEqual([
        {
          action: 'delete',
          changes: {
            type: ChatConversationType.Channel,
            title: 'Committed send/delete race',
            messagesErased: 2,
          },
        },
      ])

      await expect(
        container.chatService.send(
          conversationId,
          { clientMsgId: crypto.randomUUID(), body: 'prekasno' },
          author,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    } finally {
      releaseSend.resolve()
      await Promise.allSettled([
        sendPromise,
        ...(deletePromise === undefined ? [] : [deletePromise]),
      ])
      await Promise.allSettled(
        [originalPath, thumbnailPath]
          .filter((path) => path !== '')
          .map((path) => container.storageService.delete(path)),
      )
    }
  })
})
