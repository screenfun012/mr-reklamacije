import { schema } from '@mr/db'
import {
  ADMIN_PERMISSIONS,
  AuditAction,
  CustomerKind,
  ERROR_CODE,
  PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
  ResourceChangedKey,
  SYSTEM_ROLE_ADMIN,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  SYSTEM_ROLE_VIEWER,
  UserAccountStatus,
} from '@mr/shared'
import { and, eq } from 'drizzle-orm'
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
const SESSION_REVOKE_PENDING_ID = '22222222-2222-4222-8222-222222222229'
const PENDING_REJECT_SESSION_ID = '22222222-2222-4222-8222-222222222230'

const TARGET_SESSION_TOKEN = 'target-session-revoke-integration-token'
const ACTOR_SESSION_TOKEN = 'actor-session-revoke-integration-token'
const PENDING_SESSION_TOKEN = 'pending-session-revoke-integration-token'

const RESET_PW_NO_ACCOUNT_ID = '66666666-6666-4666-8666-666666666666'
const RESET_PW_WITH_ACCOUNT_ID = '66666666-6666-4666-8666-666666666667'
const RESET_PW_SESSION_USER_ID = '66666666-6666-4666-8666-666666666668'
const RESET_PW_ACTOR_ID = '66666666-6666-4666-8666-666666666669'
const RESET_PW_SESSION_TOKEN = 'reset-pw-target-session-token'
const RESET_PW_ACTOR_SESSION_TOKEN = 'reset-pw-actor-session-token'
const RESET_PW_VALID_PASSWORD = 'brand-new-secure-pass-123'
const RESET_PW_OLD_PASSWORD = 'previous-secure-pass-000'
const RESET_PW_SHORT_PASSWORD = 'too-short'
const RESET_PW_PERMISSIONS = ['users.reset_password'] as const

const SET_ACTIVE_TARGET_ID = '88888888-8888-4888-8888-888888888881'
const SET_ACTIVE_ACTOR_ID = '88888888-8888-4888-8888-888888888882'
const SET_ACTIVE_REACTIVATE_ID = '88888888-8888-4888-8888-888888888883'
const SET_ACTIVE_TARGET_TOKEN = 'set-active-target-session-token'
const SET_ACTIVE_REACTIVATE_TOKEN = 'set-active-reactivate-session-token'
const SET_ACTIVE_PERMISSIONS = ['users.deactivate'] as const

async function insertTestSession(
  db: TestDbContext['db'],
  userId: string,
  token: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await db
    .insert(schema.sessions)
    .values({
      userId,
      token,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: schema.sessions.token,
      set: { expiresAt, userId },
    })
}

async function countSessionsForUser(db: TestDbContext['db'], userId: string): Promise<number> {
  const rows = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(eq(schema.sessions.userId, userId))

  return rows.length
}

async function seedApprovedUserWithId(
  db: TestDbContext['db'],
  id: string,
  email: string,
  name: string,
): Promise<void> {
  await db
    .insert(schema.users)
    .values({ id, email, name, accountStatus: UserAccountStatus.Approved })
    .onConflictDoNothing()
}

async function seedCredentialAccount(
  db: TestDbContext['db'],
  userId: string,
  password: string,
): Promise<void> {
  await db
    .insert(schema.accounts)
    .values({ accountId: userId, providerId: 'credential', userId, password })
    .onConflictDoNothing()
}

async function getCredentialPasswordHash(
  db: TestDbContext['db'],
  userId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ password: schema.accounts.password })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.providerId, 'credential')))
    .limit(1)

  return row?.password ?? null
}

async function resetPassword(
  app: ReturnType<typeof createUsersTestApp>,
  userId: string,
  newPassword: string,
): Promise<Response> {
  return app.request(`/api/users/${userId}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newPassword }),
  })
}

async function setActive(
  app: ReturnType<typeof createUsersTestApp>,
  userId: string,
  isActive: boolean,
): Promise<Response> {
  return app.request(`/api/users/${userId}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive }),
  })
}

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

const CLIENT_APPROVE_PERMISSIONS = [...ADMIN_USER_PERMISSIONS, 'customers.link_users'] as const

const LINKABLE_CUSTOMER_ID = '77777777-7777-4777-8777-777777777777'
const MISSING_CUSTOMER_ID = '77777777-7777-4777-8777-7777777700ff'
const PENDING_CLIENT_OK_ID = '22222222-2222-4222-8222-222222222231'
const PENDING_CLIENT_NO_CUSTOMER_ID = '22222222-2222-4222-8222-222222222232'
const PENDING_CLIENT_BAD_CUSTOMER_ID = '22222222-2222-4222-8222-222222222233'
const PENDING_CLIENT_NO_PERM_ID = '22222222-2222-4222-8222-222222222234'
const PENDING_OPERATOR_WITH_CUSTOMER_ID = '22222222-2222-4222-8222-222222222235'

async function seedLinkableCustomer(db: TestDbContext['db']): Promise<void> {
  await db
    .insert(schema.customers)
    .values({
      id: LINKABLE_CUSTOMER_ID,
      kind: CustomerKind.EmotivePartner,
      name: 'Bosch GmbH',
      isActive: true,
    })
    .onConflictDoNothing()
}

async function getAccountStatus(
  db: TestDbContext['db'],
  userId: string,
): Promise<string | undefined> {
  const [user] = await db
    .select({ accountStatus: schema.users.accountStatus })
    .from(schema.users)
    .where(eq(schema.users.id, userId))

  return user?.accountStatus
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
    await seedApprovedUserWithId(
      ctx.db,
      RESET_PW_ACTOR_ID,
      'reset-actor@mrengines.rs',
      'Reset Actor',
    )
    await seedApprovedUserWithId(
      ctx.db,
      SET_ACTIVE_ACTOR_ID,
      'set-active-actor@mrengines.rs',
      'Set Active Actor',
    )
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

    // Regression: the keyset cursor used to carry createdAt.getTime() (a number),
    // producing `timestamptz < bigint` — Postgres rejected it and page 2 500-ed.
    // The cursor now carries created_at::text compared via ::timestamptz.
    it('paginates past the first page via the keyset cursor without overlap', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const firstResponse = await app.request('/api/users?limit=2')
      expect(firstResponse.status).toBe(200)
      const firstPage = (await firstResponse.json()) as {
        items: Array<{ id: string }>
        nextCursor: string | null
        hasMore: boolean
      }
      expect(firstPage.items).toHaveLength(2)
      expect(firstPage.hasMore).toBe(true)
      const nextCursor = firstPage.nextCursor
      if (nextCursor === null) {
        throw new Error('Expected a next cursor on the first page')
      }

      const secondResponse = await app.request(
        `/api/users?limit=2&cursor=${encodeURIComponent(nextCursor)}`,
      )
      expect(secondResponse.status).toBe(200)
      const secondPage = (await secondResponse.json()) as {
        items: Array<{ id: string }>
        nextCursor: string | null
      }
      expect(secondPage.items.length).toBeGreaterThan(0)

      const firstIds = new Set(firstPage.items.map((item) => item.id))
      expect(secondPage.items.some((item) => firstIds.has(item.id))).toBe(false)
    })
  })

  describe('when updating account status', () => {
    it('clears requested_company on approval and keeps the typed value in the audit', async () => {
      // The applicant's typed company is only a hint for the approver; approval
      // resolves it into a real firm, so the text is cleared (docs/16 §5.2). The
      // audit row is then the ONLY record of what they typed — nothing re-enters it.
      const REQUESTED_COMPANY_USER_ID = '77777777-7777-4777-8777-777777777771'
      await seedPendingUser(
        ctx.db,
        REQUESTED_COMPANY_USER_ID,
        'requested-company@mrengines.rs',
        'Requested Company Applicant',
      )
      await ctx.db
        .update(schema.users)
        .set({ requestedCompany: 'Auto Servis Petrović' })
        .where(eq(schema.users.id, REQUESTED_COMPANY_USER_ID))

      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))
      const response = await app.request(`/api/users/${REQUESTED_COMPANY_USER_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: UserAccountStatus.Approved,
          roleCode: SYSTEM_ROLE_OPERATOR,
        }),
      })
      expect(response.status).toBe(200)

      const [row] = await ctx.db
        .select({ requestedCompany: schema.users.requestedCompany })
        .from(schema.users)
        .where(eq(schema.users.id, REQUESTED_COMPANY_USER_ID))
      expect(row?.requestedCompany).toBeNull()

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, REQUESTED_COMPANY_USER_ID))
      const approveAudit = auditRows.find(
        (auditRow) =>
          auditRow.changes !== null &&
          typeof auditRow.changes === 'object' &&
          'before' in auditRow.changes &&
          (auditRow.changes as { before?: { requestedCompany?: string | null } }).before
            ?.requestedCompany === 'Auto Servis Petrović',
      )
      expect(approveAudit).toBeDefined()
      expect(
        (approveAudit?.changes as { after?: { requestedCompany?: string | null } }).after
          ?.requestedCompany,
      ).toBeNull()
    })

    it('approves a pending user with an explicit operator role, writes audit log, and emits SSE', async () => {
      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${PENDING_USER_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: UserAccountStatus.Approved,
          roleCode: SYSTEM_ROLE_OPERATOR,
        }),
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
        body: JSON.stringify({
          status: UserAccountStatus.Approved,
          roleCode: SYSTEM_ROLE_OPERATOR,
        }),
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
          body: JSON.stringify({
            status: UserAccountStatus.Approved,
            roleCode: SYSTEM_ROLE_OPERATOR,
          }),
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
          { status: UserAccountStatus.Approved, roleCode: SYSTEM_ROLE_OPERATOR, customerIds: [] },
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

  describe('when roles change (session revoke)', () => {
    it('revokes target sessions after PUT /roles and leaves actor sessions intact', async () => {
      await insertTestSession(ctx.db, APPROVED_USER_ID, TARGET_SESSION_TOKEN)
      await insertTestSession(ctx.db, ROLES_ADMIN_ACTOR_ID, ACTOR_SESSION_TOKEN)

      expect(await countSessionsForUser(ctx.db, APPROVED_USER_ID)).toBe(1)
      expect(await countSessionsForUser(ctx.db, ROLES_ADMIN_ACTOR_ID)).toBe(1)

      const app = createUsersTestApp(
        container,
        testUser([...ROLES_ASSIGN_PERMISSIONS], ROLES_ADMIN_ACTOR_ID),
      )

      const response = await putUserRoles(app, APPROVED_USER_ID, [SYSTEM_ROLE_OPERATOR])
      expect(response.status).toBe(200)

      expect(await countSessionsForUser(ctx.db, APPROVED_USER_ID)).toBe(0)
      expect(await countSessionsForUser(ctx.db, ROLES_ADMIN_ACTOR_ID)).toBe(1)
    })

    it('revokes target sessions after approve with role and leaves actor sessions intact', async () => {
      await seedPendingUser(
        ctx.db,
        SESSION_REVOKE_PENDING_ID,
        'session-revoke@mrengines.rs',
        'Session Revoke Pending',
      )
      await insertTestSession(ctx.db, SESSION_REVOKE_PENDING_ID, PENDING_SESSION_TOKEN)
      await insertTestSession(ctx.db, TEST_USER_ID, ACTOR_SESSION_TOKEN)

      expect(await countSessionsForUser(ctx.db, SESSION_REVOKE_PENDING_ID)).toBe(1)
      expect(await countSessionsForUser(ctx.db, TEST_USER_ID)).toBe(1)

      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${SESSION_REVOKE_PENDING_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: UserAccountStatus.Approved,
          roleCode: SYSTEM_ROLE_OPERATOR,
        }),
      })

      expect(response.status).toBe(200)

      expect(await countSessionsForUser(ctx.db, SESSION_REVOKE_PENDING_ID)).toBe(0)
      expect(await countSessionsForUser(ctx.db, TEST_USER_ID)).toBe(1)
    })

    it('does not revoke sessions when rejecting a pending user', async () => {
      await seedPendingUser(
        ctx.db,
        PENDING_REJECT_SESSION_ID,
        'reject-session@mrengines.rs',
        'Reject Session',
      )
      await insertTestSession(ctx.db, PENDING_REJECT_SESSION_ID, 'reject-pending-session-token')

      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${PENDING_REJECT_SESSION_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: UserAccountStatus.Rejected }),
      })

      expect(response.status).toBe(200)
      expect(await countSessionsForUser(ctx.db, PENDING_REJECT_SESSION_ID)).toBe(1)
    })
  })

  describe('when resetting a password (admin-initiated)', () => {
    async function verifyPassword(userId: string, password: string): Promise<boolean> {
      const hash = await getCredentialPasswordHash(ctx.db, userId)
      if (hash === null) {
        return false
      }

      const authCtx = await container.auth.$context
      return authCtx.password.verify({ hash, password })
    }

    it('creates a credential account and sets the password when the user has none', async () => {
      await seedApprovedUserWithId(
        ctx.db,
        RESET_PW_NO_ACCOUNT_ID,
        'reset-no-account@mrengines.rs',
        'Reset No Account',
      )
      expect(await getCredentialPasswordHash(ctx.db, RESET_PW_NO_ACCOUNT_ID)).toBeNull()

      const app = createUsersTestApp(
        container,
        testUser([...RESET_PW_PERMISSIONS], RESET_PW_ACTOR_ID),
      )

      const response = await resetPassword(app, RESET_PW_NO_ACCOUNT_ID, RESET_PW_VALID_PASSWORD)
      expect(response.status).toBe(204)

      expect(await verifyPassword(RESET_PW_NO_ACCOUNT_ID, RESET_PW_VALID_PASSWORD)).toBe(true)
    })

    it('updates the password and writes audit without the password value', async () => {
      await seedApprovedUserWithId(
        ctx.db,
        RESET_PW_WITH_ACCOUNT_ID,
        'reset-with-account@mrengines.rs',
        'Reset With Account',
      )
      await seedCredentialAccount(ctx.db, RESET_PW_WITH_ACCOUNT_ID, RESET_PW_OLD_PASSWORD)

      const app = createUsersTestApp(
        container,
        testUser([...RESET_PW_PERMISSIONS], RESET_PW_ACTOR_ID),
      )

      const response = await resetPassword(app, RESET_PW_WITH_ACCOUNT_ID, RESET_PW_VALID_PASSWORD)
      expect(response.status).toBe(204)

      const hash = await getCredentialPasswordHash(ctx.db, RESET_PW_WITH_ACCOUNT_ID)
      expect(hash).not.toBe(RESET_PW_OLD_PASSWORD)
      expect(await verifyPassword(RESET_PW_WITH_ACCOUNT_ID, RESET_PW_VALID_PASSWORD)).toBe(true)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, RESET_PW_WITH_ACCOUNT_ID))

      const resetAudit = auditRows.find(
        (row) =>
          row.action === AuditAction.Update &&
          row.changes !== null &&
          typeof row.changes === 'object' &&
          (row.changes as { field?: string }).field === 'password',
      )
      expect(resetAudit).toBeDefined()
      expect(resetAudit?.entityType).toBe('user')
      expect(JSON.stringify(resetAudit?.changes)).not.toContain(RESET_PW_VALID_PASSWORD)

      expect(eventBus.resourceEvents.map((event) => event.resource)).toContain(
        ResourceChangedKey.Users,
      )
    })

    it('returns 403 and does not change the password of the protected super-admin', async () => {
      await seedCredentialAccount(ctx.db, PROTECTED_SUPER_ADMIN_ID, RESET_PW_OLD_PASSWORD)

      const app = createUsersTestApp(
        container,
        testUser([...RESET_PW_PERMISSIONS], RESET_PW_ACTOR_ID),
      )

      const response = await resetPassword(app, PROTECTED_SUPER_ADMIN_ID, RESET_PW_VALID_PASSWORD)
      expect(response.status).toBe(403)

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)

      expect(await getCredentialPasswordHash(ctx.db, PROTECTED_SUPER_ADMIN_ID)).toBe(
        RESET_PW_OLD_PASSWORD,
      )
    })

    it('returns 403 when an actor tries to reset their own password', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...RESET_PW_PERMISSIONS], RESET_PW_ACTOR_ID),
      )

      const response = await resetPassword(app, RESET_PW_ACTOR_ID, RESET_PW_VALID_PASSWORD)
      expect(response.status).toBe(403)

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)
    })

    it('returns 400 for a password shorter than the minimum length', async () => {
      await seedApprovedUserWithId(
        ctx.db,
        RESET_PW_NO_ACCOUNT_ID,
        'reset-short@mrengines.rs',
        'Reset Short',
      )

      const app = createUsersTestApp(
        container,
        testUser([...RESET_PW_PERMISSIONS], RESET_PW_ACTOR_ID),
      )

      const response = await resetPassword(app, RESET_PW_NO_ACCOUNT_ID, RESET_PW_SHORT_PASSWORD)
      expect(response.status).toBe(400)

      expect(await getCredentialPasswordHash(ctx.db, RESET_PW_NO_ACCOUNT_ID)).toBeNull()
    })

    it('returns 403 without users.reset_password permission', async () => {
      await seedApprovedUserWithId(
        ctx.db,
        RESET_PW_WITH_ACCOUNT_ID,
        'reset-no-perm@mrengines.rs',
        'Reset No Perm',
      )

      const app = createUsersTestApp(container, testUser(['users.view'], RESET_PW_ACTOR_ID))

      const response = await resetPassword(app, RESET_PW_WITH_ACCOUNT_ID, RESET_PW_VALID_PASSWORD)
      expect(response.status).toBe(403)
    })

    it('returns 404 for a non-existent user', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...RESET_PW_PERMISSIONS], RESET_PW_ACTOR_ID),
      )

      const response = await resetPassword(
        app,
        '66666666-6666-4666-8666-66666666ffff',
        RESET_PW_VALID_PASSWORD,
      )
      expect(response.status).toBe(404)
    })

    it('revokes target sessions after reset and leaves actor sessions intact', async () => {
      await seedApprovedUserWithId(
        ctx.db,
        RESET_PW_SESSION_USER_ID,
        'reset-session@mrengines.rs',
        'Reset Session',
      )
      await insertTestSession(ctx.db, RESET_PW_SESSION_USER_ID, RESET_PW_SESSION_TOKEN)
      await insertTestSession(ctx.db, RESET_PW_ACTOR_ID, RESET_PW_ACTOR_SESSION_TOKEN)

      expect(await countSessionsForUser(ctx.db, RESET_PW_SESSION_USER_ID)).toBe(1)
      expect(await countSessionsForUser(ctx.db, RESET_PW_ACTOR_ID)).toBe(1)

      const app = createUsersTestApp(
        container,
        testUser([...RESET_PW_PERMISSIONS], RESET_PW_ACTOR_ID),
      )

      const response = await resetPassword(app, RESET_PW_SESSION_USER_ID, RESET_PW_VALID_PASSWORD)
      expect(response.status).toBe(204)

      expect(await countSessionsForUser(ctx.db, RESET_PW_SESSION_USER_ID)).toBe(0)
      expect(await countSessionsForUser(ctx.db, RESET_PW_ACTOR_ID)).toBe(1)
    })
  })

  describe('when approving as a client (portal access)', () => {
    it('approves as client, links the customer atomically, audits the link, and emits SSE', async () => {
      await seedLinkableCustomer(ctx.db)
      await seedPendingUser(ctx.db, PENDING_CLIENT_OK_ID, 'client.ok@firma.rs', 'Client Ok')
      // The approval commits via its nested transaction (shared connection), so a
      // prior run can leave a committed customer_users row — clear it for idempotency.
      await ctx.db
        .delete(schema.customerUsers)
        .where(eq(schema.customerUsers.userId, PENDING_CLIENT_OK_ID))

      const app = createUsersTestApp(
        container,
        testUser([...CLIENT_APPROVE_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request(`/api/users/${PENDING_CLIENT_OK_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: UserAccountStatus.Approved,
          roleCode: SYSTEM_ROLE_CLIENT,
          customerIds: [LINKABLE_CUSTOMER_ID],
        }),
      })

      expect(response.status).toBe(200)

      const updated = (await response.json()) as { accountStatus: string; roles: string[] }
      expect(updated.accountStatus).toBe(UserAccountStatus.Approved)
      expect(updated.roles).toEqual([SYSTEM_ROLE_CLIENT])

      const links = await ctx.db
        .select({ customerId: schema.customerUsers.customerId })
        .from(schema.customerUsers)
        .where(eq(schema.customerUsers.userId, PENDING_CLIENT_OK_ID))

      expect(links.map((row) => row.customerId)).toEqual([LINKABLE_CUSTOMER_ID])

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, PENDING_CLIENT_OK_ID))

      const approveAudit = auditRows.find(
        (row) =>
          row.changes !== null &&
          typeof row.changes === 'object' &&
          'after' in row.changes &&
          Array.isArray(
            (row.changes as { after?: { linkedCustomerIds?: string[] } }).after?.linkedCustomerIds,
          ),
      )
      expect(approveAudit).toBeDefined()
      expect(
        (approveAudit?.changes as { after?: { linkedCustomerIds?: string[] } }).after
          ?.linkedCustomerIds,
      ).toEqual([LINKABLE_CUSTOMER_ID])

      expect(eventBus.resourceEvents.map((event) => event.resource)).toContain(
        ResourceChangedKey.Users,
      )
    })

    it('returns 400 when approving a client without customerIds and leaves the user pending', async () => {
      await seedPendingUser(
        ctx.db,
        PENDING_CLIENT_NO_CUSTOMER_ID,
        'client.nocust@firma.rs',
        'Client NoCust',
      )

      const app = createUsersTestApp(
        container,
        testUser([...CLIENT_APPROVE_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request(
        `/api/users/${PENDING_CLIENT_NO_CUSTOMER_ID}/account-status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: UserAccountStatus.Approved,
            roleCode: SYSTEM_ROLE_CLIENT,
          }),
        },
      )

      expect(response.status).toBe(400)
      expect(await getAccountStatus(ctx.db, PENDING_CLIENT_NO_CUSTOMER_ID)).toBe(
        UserAccountStatus.Pending,
      )
    })

    it('returns 400 when approving a non-client role with customerIds', async () => {
      await seedLinkableCustomer(ctx.db)
      await seedPendingUser(
        ctx.db,
        PENDING_OPERATOR_WITH_CUSTOMER_ID,
        'op.cust@firma.rs',
        'Operator Cust',
      )

      const app = createUsersTestApp(
        container,
        testUser([...CLIENT_APPROVE_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request(
        `/api/users/${PENDING_OPERATOR_WITH_CUSTOMER_ID}/account-status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: UserAccountStatus.Approved,
            roleCode: SYSTEM_ROLE_OPERATOR,
            customerIds: [LINKABLE_CUSTOMER_ID],
          }),
        },
      )

      expect(response.status).toBe(400)
    })

    it('rejects with 400 when a linked customer is invalid (validated before any write)', async () => {
      await seedPendingUser(
        ctx.db,
        PENDING_CLIENT_BAD_CUSTOMER_ID,
        'client.bad@firma.rs',
        'Client Bad',
      )

      const app = createUsersTestApp(
        container,
        testUser([...CLIENT_APPROVE_PERMISSIONS], TEST_USER_ID),
      )

      const response = await app.request(
        `/api/users/${PENDING_CLIENT_BAD_CUSTOMER_ID}/account-status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: UserAccountStatus.Approved,
            roleCode: SYSTEM_ROLE_CLIENT,
            customerIds: [MISSING_CUSTOMER_ID],
          }),
        },
      )

      // Customers are validated inside the approval transaction BEFORE any write,
      // so an invalid customer aborts the whole approval — the role is never
      // assigned and no link is created. Post-state cannot be asserted here: the
      // repository transaction shares the per-test BEGIN/ROLLBACK connection, so
      // its ROLLBACK also discards the test's own seed (same harness limitation as
      // the "no partial update" rollback test above, which asserts only rejection).
      expect(response.status).toBe(400)

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.ValidationError)
    })

    it('returns 403 when the actor lacks customers.link_users and leaves the user pending', async () => {
      await seedLinkableCustomer(ctx.db)
      await seedPendingUser(
        ctx.db,
        PENDING_CLIENT_NO_PERM_ID,
        'client.noperm@firma.rs',
        'Client NoPerm',
      )

      const app = createUsersTestApp(container, testUser([...ADMIN_USER_PERMISSIONS], TEST_USER_ID))

      const response = await app.request(`/api/users/${PENDING_CLIENT_NO_PERM_ID}/account-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: UserAccountStatus.Approved,
          roleCode: SYSTEM_ROLE_CLIENT,
          customerIds: [LINKABLE_CUSTOMER_ID],
        }),
      })

      expect(response.status).toBe(403)

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)
      expect(await getAccountStatus(ctx.db, PENDING_CLIENT_NO_PERM_ID)).toBe(
        UserAccountStatus.Pending,
      )
    })
  })

  describe('when setting a user active flag (deactivate/reactivate)', () => {
    it('deactivates a user: flips is_active, revokes their sessions, audits and emits', async () => {
      await seedApprovedUserWithId(
        ctx.db,
        SET_ACTIVE_TARGET_ID,
        'set-active-target@mrengines.rs',
        'Set Active Target',
      )
      await insertTestSession(ctx.db, SET_ACTIVE_TARGET_ID, SET_ACTIVE_TARGET_TOKEN)
      expect(await countSessionsForUser(ctx.db, SET_ACTIVE_TARGET_ID)).toBe(1)

      const app = createUsersTestApp(
        container,
        testUser([...SET_ACTIVE_PERMISSIONS], SET_ACTIVE_ACTOR_ID),
      )

      const response = await setActive(app, SET_ACTIVE_TARGET_ID, false)
      expect(response.status).toBe(200)

      const updated = (await response.json()) as { isActive: boolean }
      expect(updated.isActive).toBe(false)

      const [row] = await ctx.db
        .select({ isActive: schema.users.isActive })
        .from(schema.users)
        .where(eq(schema.users.id, SET_ACTIVE_TARGET_ID))
        .limit(1)
      expect(row?.isActive).toBe(false)

      // Deactivation is the off-boarding step — the target is logged out everywhere.
      expect(await countSessionsForUser(ctx.db, SET_ACTIVE_TARGET_ID)).toBe(0)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, SET_ACTIVE_TARGET_ID))
      const deactivateAudit = auditRows.find(
        (r) =>
          r.action === AuditAction.Update &&
          r.changes !== null &&
          typeof r.changes === 'object' &&
          (r.changes as { field?: string }).field === 'isActive',
      )
      expect(deactivateAudit).toBeDefined()
      expect(deactivateAudit?.entityType).toBe('user')

      expect(eventBus.resourceEvents.map((event) => event.resource)).toContain(
        ResourceChangedKey.Users,
      )
    })

    it('reactivates a user: flips is_active true (Restore) without revoking sessions', async () => {
      await seedApprovedUserWithId(
        ctx.db,
        SET_ACTIVE_REACTIVATE_ID,
        'set-active-reactivate@mrengines.rs',
        'Set Active Reactivate',
      )
      await ctx.db
        .update(schema.users)
        .set({ isActive: false })
        .where(eq(schema.users.id, SET_ACTIVE_REACTIVATE_ID))
      await insertTestSession(ctx.db, SET_ACTIVE_REACTIVATE_ID, SET_ACTIVE_REACTIVATE_TOKEN)

      const app = createUsersTestApp(
        container,
        testUser([...SET_ACTIVE_PERMISSIONS], SET_ACTIVE_ACTOR_ID),
      )

      const response = await setActive(app, SET_ACTIVE_REACTIVATE_ID, true)
      expect(response.status).toBe(200)

      const [row] = await ctx.db
        .select({ isActive: schema.users.isActive })
        .from(schema.users)
        .where(eq(schema.users.id, SET_ACTIVE_REACTIVATE_ID))
        .limit(1)
      expect(row?.isActive).toBe(true)

      // Reactivation must not log the user out.
      expect(await countSessionsForUser(ctx.db, SET_ACTIVE_REACTIVATE_ID)).toBe(1)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, SET_ACTIVE_REACTIVATE_ID))
      const restoreAudit = auditRows.find((r) => r.action === AuditAction.Restore)
      expect(restoreAudit).toBeDefined()
    })

    it('returns 403 and does not deactivate the protected super-admin', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...SET_ACTIVE_PERMISSIONS], SET_ACTIVE_ACTOR_ID),
      )

      const response = await setActive(app, PROTECTED_SUPER_ADMIN_ID, false)
      expect(response.status).toBe(403)

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)

      const [row] = await ctx.db
        .select({ isActive: schema.users.isActive })
        .from(schema.users)
        .where(eq(schema.users.id, PROTECTED_SUPER_ADMIN_ID))
        .limit(1)
      expect(row?.isActive).toBe(true)
    })

    it('returns 403 when an actor tries to deactivate their own account', async () => {
      const app = createUsersTestApp(
        container,
        testUser([...SET_ACTIVE_PERMISSIONS], SET_ACTIVE_ACTOR_ID),
      )

      const response = await setActive(app, SET_ACTIVE_ACTOR_ID, false)
      expect(response.status).toBe(403)

      const body = (await response.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)
    })
  })
})
