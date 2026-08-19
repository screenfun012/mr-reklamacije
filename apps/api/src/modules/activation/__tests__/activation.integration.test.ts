import { schema } from '@mr/db'
import {
  CLIENT_PERMISSIONS,
  CustomerKind,
  SYSTEM_ROLE_CLIENT,
  SYSTEM_ROLE_OPERATOR,
  UserAccountStatus,
} from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEmailPort } from '../../../test-helpers/recording-email-port.js'
import {
  buildTestContainer,
  createActivationTestApp,
  createUsersTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const PORTAL_ORIGIN = 'http://127.0.0.1:3003'
const FOREIGN_ORIGIN = 'http://127.0.0.1:3002'

const VALID_PASSWORD = 'brand-new-secure-pass-123'

/**
 * The four users-screen actions plus the client set's own, because since R-6 the server refuses to
 * hand out an action the approver does not hold (guarantee 2 of the roles spec). In production the
 * approver is `admin`, who holds everything; these suites are about the ACTIVATION EMAIL, so the
 * actor just has to be a legal one.
 */
const CLIENT_APPROVE_PERMISSIONS = [
  'users.view',
  'users.approve_registration',
  'users.reject_registration',
  'customers.link_users',
  ...CLIENT_PERMISSIONS,
] as const

const LINKABLE_CUSTOMER_ID = '77777777-7777-4777-8777-7777777700c1'
const PENDING_CLIENT_ID = '22222222-2222-4222-8222-2222222200c1'
const APPROVED_CLIENT_ID = '22222222-2222-4222-8222-2222222200c2'
const APPROVED_OPERATOR_ID = '22222222-2222-4222-8222-2222222200c3'

async function getRoleId(db: TestDbContext['db'], code: string): Promise<string> {
  const [role] = await db
    .select({ id: schema.roles.id })
    .from(schema.roles)
    .where(eq(schema.roles.code, code))
    .limit(1)
  if (role === undefined) {
    throw new Error(`Role ${code} not found — run system seeds`)
  }
  return role.id
}

async function seedAdminActor(db: TestDbContext['db']): Promise<void> {
  await db
    .insert(schema.users)
    .values({
      id: TEST_USER_ID,
      email: 'admin-activation@mrengines.rs',
      name: 'Admin',
      accountStatus: UserAccountStatus.Approved,
    })
    .onConflictDoUpdate({
      target: schema.users.id,
      set: { accountStatus: UserAccountStatus.Approved },
    })
}

async function seedCustomer(db: TestDbContext['db']): Promise<void> {
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

async function seedUser(
  db: TestDbContext['db'],
  id: string,
  email: string,
  accountStatus: UserAccountStatus,
  roleCode: string | null,
): Promise<void> {
  await db.delete(schema.clientActivationTokens).where(eq(schema.clientActivationTokens.userId, id))
  await db.delete(schema.customerUsers).where(eq(schema.customerUsers.userId, id))
  await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, id))
  await db
    .insert(schema.users)
    .values({ id, email, name: 'Klijent Testni', accountStatus })
    .onConflictDoUpdate({ target: schema.users.id, set: { accountStatus, email } })

  if (roleCode !== null) {
    const roleId = await getRoleId(db, roleCode)
    await db
      .insert(schema.userRoles)
      .values({ userId: id, roleId, assignedBy: TEST_USER_ID })
      .onConflictDoNothing()
  }
}

async function credentialHash(db: TestDbContext['db'], userId: string): Promise<string | null> {
  const [row] = await db
    .select({ password: schema.accounts.password })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.userId, userId), eq(schema.accounts.providerId, 'credential')))
    .limit(1)
  return row?.password ?? null
}

describe.sequential('Activation module', () => {
  let ctx: TestDbContext
  let container: Container
  let email: RecordingEmailPort

  beforeEach(async () => {
    ctx = await createTestDbContext()
    email = new RecordingEmailPort()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, undefined, email)
    await seedAdminActor(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('sends an activation email on client approval and reports activationEmailSent', async () => {
    await seedCustomer(ctx.db)
    await seedUser(
      ctx.db,
      PENDING_CLIENT_ID,
      'pending.client@firma.rs',
      UserAccountStatus.Pending,
      null,
    )

    const app = createUsersTestApp(
      container,
      testUser([...CLIENT_APPROVE_PERMISSIONS], TEST_USER_ID),
    )

    const response = await app.request(`/api/users/${PENDING_CLIENT_ID}/account-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: UserAccountStatus.Approved,
        roleCode: SYSTEM_ROLE_CLIENT,
        customerIds: [LINKABLE_CUSTOMER_ID],
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { accountStatus: string; activationEmailSent: boolean }
    expect(body.accountStatus).toBe(UserAccountStatus.Approved)
    expect(body.activationEmailSent).toBe(true)

    expect(email.sent).toHaveLength(1)
    expect(email.sent[0]?.to).toBe('pending.client@firma.rs')
    expect(email.sent[0]?.html).toContain('/activate?token=')
  })

  it('keeps approval working when the email send fails (activationEmailSent false)', async () => {
    const failingEmail = new RecordingEmailPort(true)
    const failingContainer = buildTestContainer(
      ctx.db,
      ctx.pool,
      ctx.databaseUrl,
      undefined,
      failingEmail,
    )
    await seedCustomer(ctx.db)
    await seedUser(
      ctx.db,
      PENDING_CLIENT_ID,
      'pending.fail@firma.rs',
      UserAccountStatus.Pending,
      null,
    )

    const app = createUsersTestApp(
      failingContainer,
      testUser([...CLIENT_APPROVE_PERMISSIONS], TEST_USER_ID),
    )

    const response = await app.request(`/api/users/${PENDING_CLIENT_ID}/account-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: UserAccountStatus.Approved,
        roleCode: SYSTEM_ROLE_CLIENT,
        customerIds: [LINKABLE_CUSTOMER_ID],
      }),
    })

    expect(response.status).toBe(200)
    const body = (await response.json()) as { accountStatus: string; activationEmailSent: boolean }
    expect(body.accountStatus).toBe(UserAccountStatus.Approved)
    expect(body.activationEmailSent).toBe(false)
  })

  it('sets the first password from a valid token, then rejects token reuse', async () => {
    await seedUser(
      ctx.db,
      APPROVED_CLIENT_ID,
      'approved.client@firma.rs',
      UserAccountStatus.Approved,
      SYSTEM_ROLE_CLIENT,
    )
    const token = await container.activationRepository.mint(APPROVED_CLIENT_ID)

    const app = createActivationTestApp(container)

    const first = await app.request('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: PORTAL_ORIGIN },
      body: JSON.stringify({ token, newPassword: VALID_PASSWORD }),
    })
    expect(first.status).toBe(204)

    const hash = await credentialHash(ctx.db, APPROVED_CLIENT_ID)
    expect(hash).not.toBeNull()
    const authCtx = await container.auth.$context
    expect(await authCtx.password.verify({ hash: hash!, password: VALID_PASSWORD })).toBe(true)

    // Single-use: the same token can no longer be used.
    const second = await app.request('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: PORTAL_ORIGIN },
      body: JSON.stringify({ token, newPassword: VALID_PASSWORD }),
    })
    expect(second.status).toBe(400)
  })

  it('returns 400 (not 500) for an expired token', async () => {
    await seedUser(
      ctx.db,
      APPROVED_CLIENT_ID,
      'expired.client@firma.rs',
      UserAccountStatus.Approved,
      SYSTEM_ROLE_CLIENT,
    )
    const token = await container.activationRepository.mint(APPROVED_CLIENT_ID)
    await ctx.db
      .update(schema.clientActivationTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.clientActivationTokens.userId, APPROVED_CLIENT_ID))

    const app = createActivationTestApp(container)
    const response = await app.request('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: PORTAL_ORIGIN },
      body: JSON.stringify({ token, newPassword: VALID_PASSWORD }),
    })

    expect(response.status).toBe(400)
  })

  it('returns 400 for a bogus token', async () => {
    const app = createActivationTestApp(container)
    const response = await app.request('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: PORTAL_ORIGIN },
      body: JSON.stringify({ token: 'not-a-real-token', newPassword: VALID_PASSWORD }),
    })
    expect(response.status).toBe(400)
  })

  it('returns 403 for the activation endpoint from a disallowed origin', async () => {
    const app = createActivationTestApp(container)
    const response = await app.request('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: FOREIGN_ORIGIN },
      body: JSON.stringify({ token: 'x', newPassword: VALID_PASSWORD }),
    })
    expect(response.status).toBe(403)
  })

  it('resend invalidates the previous token and issues a fresh one', async () => {
    await seedUser(
      ctx.db,
      APPROVED_CLIENT_ID,
      'resend.client@firma.rs',
      UserAccountStatus.Approved,
      SYSTEM_ROLE_CLIENT,
    )
    const oldToken = await container.activationRepository.mint(APPROVED_CLIENT_ID)

    const usersApp = createUsersTestApp(
      container,
      testUser([...CLIENT_APPROVE_PERMISSIONS], TEST_USER_ID),
    )
    const resend = await usersApp.request(`/api/users/${APPROVED_CLIENT_ID}/resend-activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(resend.status).toBe(200)
    expect(((await resend.json()) as { sent: boolean }).sent).toBe(true)
    expect(email.sent).toHaveLength(1)

    // The old token is now invalid; the freshly emailed token works.
    const activationApp = createActivationTestApp(container)
    const oldAttempt = await activationApp.request('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: PORTAL_ORIGIN },
      body: JSON.stringify({ token: oldToken, newPassword: VALID_PASSWORD }),
    })
    expect(oldAttempt.status).toBe(400)

    const newToken = email.sent[0]?.html.match(/token=([^"&]+)/)?.[1]
    expect(newToken).toBeDefined()
    const newAttempt = await activationApp.request('/api/activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', origin: PORTAL_ORIGIN },
      body: JSON.stringify({ token: decodeURIComponent(newToken!), newPassword: VALID_PASSWORD }),
    })
    expect(newAttempt.status).toBe(204)
  })

  it('rejects resend-activation for a non-client user', async () => {
    await seedUser(
      ctx.db,
      APPROVED_OPERATOR_ID,
      'operator.activation@mrengines.rs',
      UserAccountStatus.Approved,
      SYSTEM_ROLE_OPERATOR,
    )

    const usersApp = createUsersTestApp(
      container,
      testUser([...CLIENT_APPROVE_PERMISSIONS], TEST_USER_ID),
    )
    const response = await usersApp.request(
      `/api/users/${APPROVED_OPERATOR_ID}/resend-activation`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    )
    expect(response.status).toBe(400)
    expect(email.sent).toHaveLength(0)
  })
})
