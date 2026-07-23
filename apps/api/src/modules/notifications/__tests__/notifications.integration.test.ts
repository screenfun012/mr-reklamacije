import { schema } from '@mr/db'
import {
  ClaimKind,
  ClaimOutcome,
  NotificationCatalog,
  NotificationEntityType,
  NotificationType,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  UserAccountStatus,
} from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ValidationError } from '../../../core/errors/domain-errors.js'
import type { HttpActorContext } from '../../../core/http/actor-context.js'
import type { ClaimNotificationContext } from '../../../core/ports/notifications-port.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import {
  buildTestContainer,
  createNotificationsTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { CustomersService } from '../../customers/index.js'
import { NotificationsRepository } from '../notifications.repository.js'
import { NotificationsService } from '../notifications.service.js'
import type { CreatedNotification, NotificationInsert } from '../notifications.types.js'

const VIEW_OWN = 'notifications.view_own'

function actorFor(userId: string): HttpActorContext {
  return { actorUserId: userId, actorIp: '203.0.113.9', actorUserAgent: 'vitest-agent' }
}

function claimContext(overrides: Partial<ClaimNotificationContext> = {}): ClaimNotificationContext {
  return {
    kind: ClaimKind.Emotive,
    id: crypto.randomUUID(),
    mrNumber: 'MR-1/26',
    customerName: 'Partner d.o.o.',
    employeeId: null,
    outcome: ClaimOutcome.Pending,
    ...overrides,
  }
}

describe('Notifications integration', () => {
  let ctx: TestDbContext
  let container: Container
  let events: RecordingEventBus
  let service: NotificationsService
  let repository: NotificationsRepository

  /** A fresh, approved user — every assertion scopes to ids created inside its own test. */
  async function createUser(name: string): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.users).values({
      id,
      email: `notif-${id}@mrengines.rs`,
      name,
      isActive: true,
      accountStatus: UserAccountStatus.Approved,
    })
    return id
  }

  async function assignRole(userId: string, roleCode: string): Promise<void> {
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

  /** An employee record wired to a user account — the `assigned_to_me` link. */
  async function createEmployeeFor(userId: string | null): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db.insert(schema.employees).values({
      id,
      fullName: `Employee ${id}`,
      normalizedName: `employee-${id}`,
      userId,
    })
    return id
  }

  async function notificationsFor(
    userId: string,
  ): Promise<{ type: string; entityType: string; entityId: string }[]> {
    return ctx.db
      .select({
        type: schema.notifications.type,
        entityType: schema.notifications.entityType,
        entityId: schema.notifications.entityId,
      })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
  }

  async function seedNotifications(userId: string, count: number): Promise<void> {
    const rows: NotificationInsert[] = Array.from({ length: count }, (_, index) => ({
      userId,
      type: NotificationType.ClaimCreated,
      entityType: NotificationEntityType.EmotiveClaim,
      entityId: crypto.randomUUID(),
      data: { mrNumber: `MR-${index}/26` },
    }))
    await repository.insertMany(rows)
  }

  beforeEach(async () => {
    ctx = await createTestDbContext()
    events = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, events)
    service = container.notificationsService
    repository = container.notificationsRepository
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  describe('inbox', () => {
    it('paginates newest-first and reports the unread count across all pages', async () => {
      const userId = await createUser('Inbox Owner')
      await seedNotifications(userId, 5)

      const firstPage = await service.list(userId, { page: 1, pageSize: 2 })
      expect(firstPage.items).toHaveLength(2)
      expect(firstPage.total).toBe(5)
      expect(firstPage.page).toBe(1)
      expect(firstPage.pageSize).toBe(2)
      expect(firstPage.unreadCount).toBe(5)

      const thirdPage = await service.list(userId, { page: 3, pageSize: 2 })
      expect(thirdPage.items).toHaveLength(1)

      const seen = [...firstPage.items, ...thirdPage.items].map((item) => item.id)
      expect(new Set(seen).size).toBe(3)
    })

    it('lists only the calling user rows', async () => {
      const owner = await createUser('Owner')
      const stranger = await createUser('Stranger')
      await seedNotifications(owner, 2)
      await seedNotifications(stranger, 3)

      const result = await service.list(owner, { page: 1, pageSize: 20 })
      expect(result.total).toBe(2)
      expect(result.unreadCount).toBe(2)
    })

    it('marks a row read idempotently, keeping the first readAt', async () => {
      const userId = await createUser('Reader')
      await seedNotifications(userId, 1)
      const [row] = await service.list(userId, { page: 1, pageSize: 20 }).then((r) => r.items)
      expect(row).toBeDefined()
      if (row === undefined) throw new Error('unreachable')

      await service.markRead(userId, row.id)
      const [afterFirst] = await ctx.db
        .select({ readAt: schema.notifications.readAt, isRead: schema.notifications.isRead })
        .from(schema.notifications)
        .where(eq(schema.notifications.id, row.id))
      expect(afterFirst?.isRead).toBe(true)

      await service.markRead(userId, row.id)
      const [afterSecond] = await ctx.db
        .select({ readAt: schema.notifications.readAt })
        .from(schema.notifications)
        .where(eq(schema.notifications.id, row.id))
      expect(afterSecond?.readAt?.toISOString()).toBe(afterFirst?.readAt?.toISOString())

      const result = await service.list(userId, { page: 1, pageSize: 20 })
      expect(result.unreadCount).toBe(0)
    })

    it('marks every unread row of the caller and leaves other users untouched', async () => {
      const owner = await createUser('Bulk Owner')
      const stranger = await createUser('Bulk Stranger')
      await seedNotifications(owner, 3)
      await seedNotifications(stranger, 2)

      await service.markAllRead(owner)

      expect((await service.list(owner, { page: 1, pageSize: 20 })).unreadCount).toBe(0)
      expect((await service.list(stranger, { page: 1, pageSize: 20 })).unreadCount).toBe(2)
    })

    it('snoozes into the future without marking the row read, and rejects the past', async () => {
      const userId = await createUser('Snoozer')
      await seedNotifications(userId, 1)
      const [row] = await service.list(userId, { page: 1, pageSize: 20 }).then((r) => r.items)
      if (row === undefined) throw new Error('unreachable')

      await expect(
        service.snooze(userId, row.id, new Date(Date.now() - 60_000)),
      ).rejects.toBeInstanceOf(ValidationError)

      const until = new Date(Date.now() + 3_600_000)
      await service.snooze(userId, row.id, until)

      const result = await service.list(userId, { page: 1, pageSize: 20 })
      expect(result.items[0]?.snoozedUntil).toBe(until.toISOString())
      expect(result.items[0]?.isRead).toBe(false)
      expect(result.unreadCount).toBe(1)
    })

    it("404s (never 403) on another user's notification for read and snooze", async () => {
      const owner = await createUser('Foreign Owner')
      const intruder = await createUser('Intruder')
      await seedNotifications(owner, 1)
      const [row] = await service.list(owner, { page: 1, pageSize: 20 }).then((r) => r.items)
      if (row === undefined) throw new Error('unreachable')

      const app = createNotificationsTestApp(container, testUser([VIEW_OWN], intruder))

      const read = await app.request(`/api/notifications/${row.id}/read`, { method: 'POST' })
      expect(read.status).toBe(404)

      const snooze = await app.request(`/api/notifications/${row.id}/snooze`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ until: new Date(Date.now() + 3_600_000).toISOString() }),
      })
      expect(snooze.status).toBe(404)

      // The row is still untouched — the intruder changed nothing.
      const [untouched] = await ctx.db
        .select({
          isRead: schema.notifications.isRead,
          snoozedUntil: schema.notifications.snoozedUntil,
        })
        .from(schema.notifications)
        .where(eq(schema.notifications.id, row.id))
      expect(untouched?.isRead).toBe(false)
      expect(untouched?.snoozedUntil).toBeNull()
    })

    it('serves the caller their own inbox over HTTP', async () => {
      const userId = await createUser('Http Owner')
      await seedNotifications(userId, 2)
      const app = createNotificationsTestApp(container, testUser([VIEW_OWN], userId))

      const response = await app.request('/api/notifications?page=1&pageSize=20')
      expect(response.status).toBe(200)
      const body = (await response.json()) as { total: number; unreadCount: number }
      expect(body.total).toBe(2)
      expect(body.unreadCount).toBe(2)

      const markAll = await app.request('/api/notifications/mark-all-read', { method: 'POST' })
      expect(markAll.status).toBe(204)
      expect((await service.list(userId, { page: 1, pageSize: 20 })).unreadCount).toBe(0)
    })

    it('deletes one of the caller rows and drops it from the inbox', async () => {
      const userId = await createUser('Deleter')
      await seedNotifications(userId, 2)
      const [row] = await service.list(userId, { page: 1, pageSize: 20 }).then((r) => r.items)
      if (row === undefined) throw new Error('unreachable')

      await service.delete(userId, row.id)

      const result = await service.list(userId, { page: 1, pageSize: 20 })
      expect(result.total).toBe(1)
      expect(result.items.some((item) => item.id === row.id)).toBe(false)
    })

    it("404s (never 403) on another user's notification for delete", async () => {
      const owner = await createUser('Delete Owner')
      const intruder = await createUser('Delete Intruder')
      await seedNotifications(owner, 1)
      const [row] = await service.list(owner, { page: 1, pageSize: 20 }).then((r) => r.items)
      if (row === undefined) throw new Error('unreachable')

      const app = createNotificationsTestApp(container, testUser([VIEW_OWN], intruder))
      const response = await app.request(`/api/notifications/${row.id}`, { method: 'DELETE' })
      expect(response.status).toBe(404)

      // The owner still has it — a foreign delete changed nothing.
      expect((await service.list(owner, { page: 1, pageSize: 20 })).total).toBe(1)
    })

    it('clears the whole inbox for the caller only', async () => {
      const owner = await createUser('Clear Owner')
      const stranger = await createUser('Clear Stranger')
      await seedNotifications(owner, 3)
      await seedNotifications(stranger, 2)

      await service.deleteAll(owner)

      expect((await service.list(owner, { page: 1, pageSize: 20 })).total).toBe(0)
      expect((await service.list(stranger, { page: 1, pageSize: 20 })).total).toBe(2)
    })
  })

  describe('fan-out', () => {
    it('never notifies the actor', async () => {
      const actorId = await createUser('Actor')
      await assignRole(actorId, SYSTEM_ROLE_OPERATOR)

      await service.notifyClaimCreated(actorId, claimContext())

      expect(await notificationsFor(actorId)).toHaveLength(0)
    })

    it('reaches an admin who has no role_permissions rows at all', async () => {
      const actorId = await createUser('Actor')
      const adminId = await createUser('Admin')
      await assignRole(adminId, SYSTEM_ROLE_ADMIN)

      // The admin bypass lives in the resolver, not in the junction table — prove fan-out
      // agrees with it even when the seed rows are gone.
      const [adminRole] = await ctx.db
        .select({ id: schema.roles.id })
        .from(schema.roles)
        .where(eq(schema.roles.code, SYSTEM_ROLE_ADMIN))
        .limit(1)
      if (adminRole === undefined) throw new Error('admin role missing')
      await ctx.db
        .delete(schema.rolePermissions)
        .where(eq(schema.rolePermissions.roleId, adminRole.id))

      const claim = claimContext()
      await service.notifyClaimCreated(actorId, claim)

      const rows = await notificationsFor(adminId)
      expect(rows).toEqual([
        {
          type: NotificationType.ClaimCreated,
          entityType: NotificationEntityType.EmotiveClaim,
          entityId: claim.id,
        },
      ])
      expect(events.notificationEvents.map((event) => event.userId)).toContain(adminId)
    })

    it('gives the assignee only assigned_to_me, never both', async () => {
      const actorId = await createUser('Actor')
      const assigneeId = await createUser('Assignee')
      const bystanderId = await createUser('Bystander')
      await assignRole(assigneeId, SYSTEM_ROLE_OPERATOR)
      await assignRole(bystanderId, SYSTEM_ROLE_OPERATOR)
      const employeeId = await createEmployeeFor(assigneeId)

      const claim = claimContext({ employeeId })
      await service.notifyClaimCreated(actorId, claim)

      expect(await notificationsFor(assigneeId)).toEqual([
        {
          type: NotificationType.AssignedToMe,
          entityType: NotificationEntityType.EmotiveClaim,
          entityId: claim.id,
        },
      ])
      expect(await notificationsFor(bystanderId)).toEqual([
        {
          type: NotificationType.ClaimCreated,
          entityType: NotificationEntityType.EmotiveClaim,
          entityId: claim.id,
        },
      ])
    })

    it('skips silently when the assigned employee has no linked account', async () => {
      const actorId = await createUser('Actor')
      const employeeId = await createEmployeeFor(null)

      await expect(
        service.notifyClaimAssigned(actorId, claimContext({ employeeId })),
      ).resolves.toBeUndefined()
    })

    it('routes a DOMACE claim to holders of domace_claims.view', async () => {
      const actorId = await createUser('Actor')
      const viewerId = await createUser('Viewer')
      await assignRole(viewerId, SYSTEM_ROLE_VIEWER)

      const claim = claimContext({ kind: ClaimKind.Domace, outcome: ClaimOutcome.Accepted })
      await service.notifyOutcomeChanged(actorId, claim)

      expect(await notificationsFor(viewerId)).toEqual([
        {
          type: NotificationType.OutcomeChanged,
          entityType: NotificationEntityType.DomaceClaim,
          entityId: claim.id,
        },
      ])
    })

    it('does not notify a pending or deactivated account', async () => {
      const actorId = await createUser('Actor')
      const pendingId = crypto.randomUUID()
      await ctx.db.insert(schema.users).values({
        id: pendingId,
        email: `pending-${pendingId}@mrengines.rs`,
        name: 'Pending',
        accountStatus: UserAccountStatus.Pending,
      })
      await assignRole(pendingId, SYSTEM_ROLE_OPERATOR)

      const deactivatedId = await createUser('Deactivated')
      await assignRole(deactivatedId, SYSTEM_ROLE_OPERATOR)
      await ctx.db
        .update(schema.users)
        .set({ isActive: false })
        .where(eq(schema.users.id, deactivatedId))

      await service.notifyClaimCreated(actorId, claimContext())

      expect(await notificationsFor(pendingId)).toHaveLength(0)
      expect(await notificationsFor(deactivatedId)).toHaveLength(0)
    })
  })

  describe('catalog fan-out', () => {
    it('fires on create but not on update or delete', async () => {
      const actorId = await createUser('Catalog Actor')
      const recipientId = await createUser('Catalog Recipient')
      await assignRole(recipientId, SYSTEM_ROLE_OPERATOR)

      const created = await container.customersService.create(
        { name: `Notif Customer ${crypto.randomUUID().slice(0, 8)}` },
        actorFor(actorId),
      )

      const afterCreate = await notificationsFor(recipientId)
      expect(afterCreate).toEqual([
        {
          type: NotificationType.CatalogAdded,
          entityType: NotificationEntityType.Catalog,
          entityId: created.id,
        },
      ])

      await container.customersService.update(created.id, { city: 'Beograd' }, actorFor(actorId))
      await container.customersService.hardDelete(created.id, actorFor(actorId))

      expect(await notificationsFor(recipientId)).toHaveLength(1)
    })

    it('carries the catalog key and item name', async () => {
      const actorId = await createUser('Catalog Actor')
      const recipientId = await createUser('Catalog Recipient')
      await assignRole(recipientId, SYSTEM_ROLE_OPERATOR)

      const name = `Notif Customer ${crypto.randomUUID().slice(0, 8)}`
      await container.customersService.create({ name }, actorFor(actorId))

      const [row] = await ctx.db
        .select({ data: schema.notifications.data })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, recipientId),
            eq(schema.notifications.type, NotificationType.CatalogAdded),
          ),
        )
      expect(row?.data).toEqual({ catalog: NotificationCatalog.Customers, itemName: name })
    })
  })

  describe('best-effort contract', () => {
    it('completes the business operation when the fan-out write fails', async () => {
      const actorId = await createUser('Resilient Actor')
      const recipientId = await createUser('Resilient Recipient')
      await assignRole(recipientId, SYSTEM_ROLE_OPERATOR)

      // Fault injection on the write path only — repositories, DB and services stay real.
      class FailingRepository extends NotificationsRepository {
        override insertMany(_rows: readonly NotificationInsert[]): Promise<CreatedNotification[]> {
          void _rows
          return Promise.reject(new Error('notifications table unavailable'))
        }
      }

      const failing = new NotificationsService(
        new FailingRepository(ctx.db),
        events,
        container.logger,
      )
      const customers = new CustomersService(
        container.customersRepository,
        container.auditService,
        events,
        failing,
      )

      const created = await customers.create(
        { name: `Resilient Customer ${crypto.randomUUID().slice(0, 8)}` },
        actorFor(actorId),
      )

      expect(created.id).toBeDefined()
      expect(await notificationsFor(recipientId)).toHaveLength(0)
    })
  })
})
