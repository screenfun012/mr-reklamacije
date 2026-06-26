import { schema } from '@mr/db'
import { AuditAction, ERROR_CODE, ResourceChangedKey, UserAccountStatus } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer, createUsersTestApp, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const ADMIN_USER_PERMISSIONS = [
  'users.view',
  'users.approve_registration',
  'users.reject_registration',
] as const

const APPROVED_USER_ID = '33333333-3333-4333-8333-333333333333'

async function seedApprovedUser(db: TestDbContext['db']): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      id: APPROVED_USER_ID,
      email: 'approved-user@mrengines.rs',
      name: 'Approved User',
      accountStatus: UserAccountStatus.Approved,
    })
    .onConflictDoNothing()
}

const PENDING_USER_ID = '22222222-2222-4222-8222-222222222222'

async function seedPendingUser(db: TestDbContext['db']): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      id: PENDING_USER_ID,
      email: 'pera.peric.test@gmail.com',
      name: 'Pera Perić',
      accountStatus: UserAccountStatus.Pending,
    })
    .onConflictDoNothing()
}

async function seedAdminUser(db: TestDbContext['db']): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      email: 'admin-test@mrengines.rs',
      name: 'Admin Test',
      accountStatus: UserAccountStatus.Approved,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { accountStatus: UserAccountStatus.Approved },
    })
}

describe('Users module', () => {
  let ctx: TestDbContext
  let container: Container
  let eventBus: RecordingEventBus

  beforeEach(async () => {
    ctx = await createTestDbContext()
    eventBus = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
    await seedAdminUser(ctx.db)
    await seedPendingUser(ctx.db)
    await seedApprovedUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  describe('when listing users', () => {
    it('returns safe fields without password_hash or two_factor secrets', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request('/api/users')
      expect(response.status).toBe(200)

      const bodyText = await response.text()
      expect(bodyText).not.toContain('password_hash')
      expect(bodyText).not.toContain('twoFactor')
      expect(bodyText).not.toContain('two_factor')

      const body = JSON.parse(bodyText) as {
        items: Array<{ email: string; accountStatus: string }>
      }
      expect(body.items.some((item) => item.email === 'pera.peric.test@gmail.com')).toBe(true)
    })

    it('filters by pending account status', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request('/api/users?accountStatus=pending')
      expect(response.status).toBe(200)

      const body = (await response.json()) as {
        items: Array<{ accountStatus: string; email: string }>
      }

      expect(body.items.length).toBeGreaterThan(0)
      expect(body.items.every((item) => item.accountStatus === UserAccountStatus.Pending)).toBe(
        true,
      )
    })

    it('returns 403 without users.view permission', async () => {
      const app = createUsersTestApp(container, testUser([], TEST_USER_ID))

      const response = await app.request('/api/users')
      expect(response.status).toBe(403)
    })
  })

  describe('when updating account status', () => {
    it('approves a pending user, writes audit log, and emits SSE', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${PENDING_USER_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: UserAccountStatus.Approved }),
      })

      expect(response.status).toBe(200)

      const updated = (await response.json()) as { accountStatus: string }
      expect(updated.accountStatus).toBe(UserAccountStatus.Approved)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, PENDING_USER_ID))

      expect(auditRows).toHaveLength(1)
      expect(auditRows[0]?.action).toBe(AuditAction.Update)
      expect(auditRows[0]?.entityType).toBe('user')

      expect(eventBus.resourceEvents.map((event) => event.resource)).toContain(
        ResourceChangedKey.Users,
      )
    })

    it('rejects a pending user', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${PENDING_USER_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: UserAccountStatus.Rejected }),
      })

      expect(response.status).toBe(200)

      const updated = (await response.json()) as { accountStatus: string }
      expect(updated.accountStatus).toBe(UserAccountStatus.Rejected)
    })

    it('returns 403 when admin tries to change own account status', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${TEST_USER_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: UserAccountStatus.Rejected }),
      })

      expect(response.status).toBe(403)

      const body = (await response.json()) as { code: string }
      expect(body.code).toBe(ERROR_CODE.Forbidden)
    })

    it('returns 400 when target user is not pending', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${APPROVED_USER_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: UserAccountStatus.Approved }),
      })

      expect(response.status).toBe(400)
    })

    it('returns 403 when actor lacks approve permission for approval', async () => {
      const app = createUsersTestApp(
        container,
        testUser(['users.view', 'users.reject_registration'], TEST_USER_ID),
      )

      const response = await app.request(`/api/users/${PENDING_USER_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: UserAccountStatus.Approved }),
      })

      expect(response.status).toBe(403)
    })
  })
})
