import { schema } from '@mr/db'
import {
  ADMIN_PERMISSIONS,
  AuditAction,
  ERROR_CODE,
  PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
  ResourceChangedKey,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  UserAccountStatus,
} from '@mr/shared'
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
  'roles.assign',
] as const

const ROLES_ASSIGN_PERMISSIONS = ['roles.assign'] as const

const APPROVED_USER_ID = '33333333-3333-4333-8333-333333333333'
const PROTECTED_SUPER_ADMIN_ID = '44444444-4444-4444-8444-444444444444'
const ROLES_ADMIN_ACTOR_ID = '55555555-5555-4555-8555-555555555555'

async function getRoleId(db: TestDbContext['db'], code: string): Promise<string> {
  const [role] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.code, code))
    .limit(1)

  if (role === undefined) {
    throw new Error(`Role ${code} not found — run system seeds in integration setup`)
  }

  return role.id
}

async function assignRole(
  db: TestDbContext['db'],
  userId: string,
  roleCode: string,
  assignedBy: string,
): Promise<void> {
  const roleId = await getRoleId(db, roleCode)

  await db.insert(schema.userRoles).values({ userId, roleId, assignedBy }).onConflictDoNothing()
}

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
const PENDING_VIEWER_APPROVE_ID = '22222222-2222-4222-8222-222222222223'
const PENDING_ADMIN_ROLE_REJECT_ID = '22222222-2222-4222-8222-222222222224'
const PENDING_ROLLBACK_ID = '22222222-2222-4222-8222-222222222225'
const PENDING_REJECT_ID = '22222222-2222-4222-8222-222222222226'
const PENDING_ROLES_422_ID = '22222222-2222-4222-8222-222222222227'
const PENDING_NO_APPROVE_PERM_ID = '22222222-2222-4222-8222-222222222228'

async function seedPendingUser(
  db: TestDbContext['db'],
  id: string,
  email: string,
  name: string,
): Promise<void> {
  await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, id))

  await db
    .insert(schema.users)
    .values({
      id,
      email,
      name,
      accountStatus: UserAccountStatus.Pending,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: {
        email,
        name,
        accountStatus: UserAccountStatus.Pending,
      },
    })
}

async function seedDefaultPendingUser(db: TestDbContext['db']): Promise<void> {
  await seedPendingUser(db, PENDING_USER_ID, 'pera.peric.test@gmail.com', 'Pera Perić')
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

async function seedRolesAdminActor(db: TestDbContext['db']): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      id: ROLES_ADMIN_ACTOR_ID,
      email: 'roles-admin@mrengines.rs',
      name: 'Roles Admin',
      accountStatus: UserAccountStatus.Approved,
    })
    .onConflictDoNothing()
}

async function seedProtectedSuperAdmin(db: TestDbContext['db']): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      id: PROTECTED_SUPER_ADMIN_ID,
      email: PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
      name: 'Protected Super Admin',
      accountStatus: UserAccountStatus.Approved,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: {
        email: PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
        accountStatus: UserAccountStatus.Approved,
      },
    })

  await assignRole(db, PROTECTED_SUPER_ADMIN_ID, SYSTEM_ROLE_ADMIN, TEST_USER_ID)
}

async function putUserRoles(
  app: ReturnType<typeof createUsersTestApp>,
  userId: string,
  roleCodes: string[],
): Promise<Response> {
  return app.request(`/api/users/${userId}/roles`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleCodes }),
  })
}

describe.sequential('Users module', () => {
  let ctx: TestDbContext
  let container: Container
  let eventBus: RecordingEventBus

  beforeEach(async () => {
    ctx = await createTestDbContext()
    eventBus = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
    await seedAdminUser(ctx.db)
    await seedDefaultPendingUser(ctx.db)
    await seedApprovedUser(ctx.db)
    await seedRolesAdminActor(ctx.db)
    await seedProtectedSuperAdmin(ctx.db)
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
    it('approves a pending user with default operator role, writes audit log, and emits SSE', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${PENDING_USER_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: UserAccountStatus.Approved }),
      })

      expect(response.status).toBe(200)

      const updated = (await response.json()) as { accountStatus: string; roles: string[] }
      expect(updated.accountStatus).toBe(UserAccountStatus.Approved)
      expect(updated.roles).toEqual([SYSTEM_ROLE_OPERATOR])

      const roleRows = await ctx.db
        .select({ code: schema.roles.code })
        .from(schema.userRoles)
        .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
        .where(eq(schema.userRoles.userId, PENDING_USER_ID))

      expect(roleRows.map((row) => row.code)).toEqual([SYSTEM_ROLE_OPERATOR])

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, PENDING_USER_ID))

      const approveAudit = auditRows.find(
        (row) =>
          row.action === AuditAction.Update &&
          row.changes !== null &&
          typeof row.changes === 'object' &&
          'after' in row.changes &&
          (row.changes as { after?: { roles?: string[] } }).after?.roles?.includes(
            SYSTEM_ROLE_OPERATOR,
          ),
      )
      expect(approveAudit).toBeDefined()
      expect(approveAudit?.entityType).toBe('user')

      expect(eventBus.resourceEvents.map((event) => event.resource)).toContain(
        ResourceChangedKey.Users,
      )
    })

    it('approves a pending user with explicit viewer role', async () => {
      await seedPendingUser(
        ctx.db,
        PENDING_VIEWER_APPROVE_ID,
        'viewer.approve@mrengines.rs',
        'Viewer Approve',
      )

      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${PENDING_VIEWER_APPROVE_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: UserAccountStatus.Approved, roleCode: SYSTEM_ROLE_VIEWER }),
      })

      expect(response.status).toBe(200)

      const updated = (await response.json()) as { accountStatus: string; roles: string[] }
      expect(updated.accountStatus).toBe(UserAccountStatus.Approved)
      expect(updated.roles).toEqual([SYSTEM_ROLE_VIEWER])
    })

    it('returns 400 when approving with admin roleCode and leaves user pending', async () => {
      await seedPendingUser(
        ctx.db,
        PENDING_ADMIN_ROLE_REJECT_ID,
        'admin.reject@mrengines.rs',
        'Admin Reject',
      )

      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(
        `/api/users/${PENDING_ADMIN_ROLE_REJECT_ID}/account-status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: UserAccountStatus.Approved, roleCode: SYSTEM_ROLE_ADMIN }),
        },
      )

      expect(response.status).toBe(400)

      const [user] = await ctx.db
        .select({ accountStatus: schema.users.accountStatus })
        .from(schema.users)
        .where(eq(schema.users.id, PENDING_ADMIN_ROLE_REJECT_ID))

      expect(user?.accountStatus).toBe(UserAccountStatus.Pending)

      const roleRows = await ctx.db
        .select()
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, PENDING_ADMIN_ROLE_REJECT_ID))

      expect(roleRows).toHaveLength(0)
    })

    it('rejects a pending user', async () => {
      await seedPendingUser(ctx.db, PENDING_REJECT_ID, 'reject@mrengines.rs', 'Reject Me')

      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${PENDING_REJECT_ID}/account-status`, {
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

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)
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
      await seedPendingUser(
        ctx.db,
        PENDING_NO_APPROVE_PERM_ID,
        'no-approve@mrengines.rs',
        'No Approve',
      )

      const app = createUsersTestApp(
        container,
        testUser(['users.view', 'users.reject_registration'], TEST_USER_ID),
      )

      const response = await app.request(
        `/api/users/${PENDING_NO_APPROVE_PERM_ID}/account-status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: UserAccountStatus.Approved }),
        },
      )

      expect(response.status).toBe(403)
    })

    it('does not approve when selected role is unavailable (no partial update)', async () => {
      await seedPendingUser(ctx.db, PENDING_ROLLBACK_ID, 'rollback@mrengines.rs', 'Rollback Me')
      await ctx.db
        .update(schema.roles)
        .set({ deletedAt: new Date() })
        .where(eq(schema.roles.code, SYSTEM_ROLE_OPERATOR))

      const before = await container.usersRepository.findAccountStatusById(PENDING_ROLLBACK_ID)
      expect(before?.accountStatus).toBe(UserAccountStatus.Pending)
      expect(before?.roles).toEqual([])

      await expect(
        container.usersService.updateAccountStatus(
          PENDING_ROLLBACK_ID,
          { status: UserAccountStatus.Approved, roleCode: SYSTEM_ROLE_OPERATOR },
          {
            actorUserId: TEST_USER_ID,
            actorIp: '127.0.0.1',
            actorUserAgent: 'test',
            permissions: [...ADMIN_USER_PERMISSIONS],
          },
        ),
      ).rejects.toMatchObject({ status: 400 })
    })
  })

  describe('when replacing user roles (NIKOLA-SAFE)', () => {
    it('assigns operator role to approved user with audit log and SSE', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...ROLES_ASSIGN_PERMISSIONS], ROLES_ADMIN_ACTOR_ID),
      )

      const response = await putUserRoles(app, APPROVED_USER_ID, [SYSTEM_ROLE_OPERATOR])
      expect(response.status).toBe(200)

      const updated = (await response.json()) as { roles: string[] }
      expect(updated.roles).toEqual([SYSTEM_ROLE_OPERATOR])

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, APPROVED_USER_ID))

      const roleAudit = auditRows.find(
        (row) =>
          row.action === AuditAction.Update &&
          row.changes !== null &&
          typeof row.changes === 'object' &&
          'after' in row.changes &&
          (row.changes as { after?: { roles?: string[] } }).after?.roles?.includes(
            SYSTEM_ROLE_OPERATOR,
          ),
      )
      expect(roleAudit).toBeDefined()

      expect(eventBus.resourceEvents.map((event) => event.resource)).toContain(
        ResourceChangedKey.Users,
      )
    })

    it('returns 403 when attacker tries to remove admin from protected super-admin', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...ROLES_ASSIGN_PERMISSIONS], ROLES_ADMIN_ACTOR_ID),
      )

      const response = await putUserRoles(app, PROTECTED_SUPER_ADMIN_ID, [SYSTEM_ROLE_OPERATOR])
      expect(response.status).toBe(403)

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)

      const roleRows = await ctx.db
        .select({ code: schema.roles.code })
        .from(schema.userRoles)
        .innerJoin(schema.roles, eq(schema.userRoles.roleId, schema.roles.id))
        .where(eq(schema.userRoles.userId, PROTECTED_SUPER_ADMIN_ID))

      expect(roleRows.map((row) => row.code)).toEqual([SYSTEM_ROLE_ADMIN])
    })

    it('returns 403 when actor tries to change own roles', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...ROLES_ASSIGN_PERMISSIONS], ROLES_ADMIN_ACTOR_ID),
      )

      const response = await putUserRoles(app, ROLES_ADMIN_ACTOR_ID, [SYSTEM_ROLE_ADMIN])
      expect(response.status).toBe(403)

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)
    })

    it('returns 403 on any role change attempt for protected super-admin including demote', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...ROLES_ASSIGN_PERMISSIONS], ROLES_ADMIN_ACTOR_ID),
      )

      const demoteResponse = await putUserRoles(app, PROTECTED_SUPER_ADMIN_ID, [SYSTEM_ROLE_VIEWER])
      expect(demoteResponse.status).toBe(403)

      const noopResponse = await putUserRoles(app, PROTECTED_SUPER_ADMIN_ID, [SYSTEM_ROLE_ADMIN])
      expect(noopResponse.status).toBe(403)
    })

    it('returns 422 when assigning roles to pending user', async () => {
      await seedPendingUser(
        ctx.db,
        PENDING_ROLES_422_ID,
        'pending-roles@mrengines.rs',
        'Pending Roles',
      )

      const app = createUsersTestApp(
        container,
        testUser([...ROLES_ASSIGN_PERMISSIONS], ROLES_ADMIN_ACTOR_ID),
      )

      const response = await putUserRoles(app, PENDING_ROLES_422_ID, [SYSTEM_ROLE_OPERATOR])
      expect(response.status).toBe(422)

      const pendingRoles = await ctx.db
        .select()
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, PENDING_ROLES_422_ID))

      expect(pendingRoles).toHaveLength(0)
    })

    it('returns 400 for empty roleCodes payload', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...ROLES_ASSIGN_PERMISSIONS], ROLES_ADMIN_ACTOR_ID),
      )

      const response = await app.request(`/api/users/${APPROVED_USER_ID}/roles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleCodes: [] }),
      })

      expect(response.status).toBe(400)
    })

    it('returns 403 without roles.assign permission', async () => {
      const app = createUsersTestApp(container, testUser(['users.view'], ROLES_ADMIN_ACTOR_ID))

      const response = await putUserRoles(app, APPROVED_USER_ID, [SYSTEM_ROLE_OPERATOR])
      expect(response.status).toBe(403)
    })

    it('operator role grants emotive_claims access but not users.view', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...ROLES_ASSIGN_PERMISSIONS], ROLES_ADMIN_ACTOR_ID),
      )

      const response = await putUserRoles(app, APPROVED_USER_ID, [SYSTEM_ROLE_OPERATOR])
      expect(response.status).toBe(200)

      const effective = await container.permissionResolver.getEffectiveForUser(APPROVED_USER_ID)

      expect(effective.has('emotive_claims.view')).toBe(true)
      expect(effective.has('users.view')).toBe(false)
    })

    it('admin role bypass grants full permission catalog', async () => {
      const effective = await container.permissionResolver.getEffectiveForRoleCodes([
        SYSTEM_ROLE_ADMIN,
      ])

      expect(effective.length).toBe(ADMIN_PERMISSIONS.length)
      expect(effective).toContain('users.view')
      expect(effective).toContain('roles.assign')
      expect(effective).toContain('emotive_claims.delete')
    })
  })
})
