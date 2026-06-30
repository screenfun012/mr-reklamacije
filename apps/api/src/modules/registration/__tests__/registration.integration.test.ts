import { schema } from '@mr/db'
import { ResourceChangedKey, UserAccountStatus } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import { clientRegistrationRateLimiter } from '../../../core/middleware/rate-limit.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import {
  buildTestContainer,
  createRegistrationTestApp,
  fakeLogger,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const PORTAL_ORIGIN = 'http://127.0.0.1:3003'
const FOREIGN_ORIGIN = 'http://127.0.0.1:3002'

const NEW_CLIENT_EMAIL = 'klijent.novi@firma.rs'
const EXISTING_EMAIL = 'postojeci.klijent@firma.rs'
const ORIGIN_BLOCK_EMAIL = 'origin.block@firma.rs'
const EXISTING_USER_ID = '88888888-8888-4888-8888-888888888801'

async function postRegistration(
  app: ReturnType<typeof createRegistrationTestApp>,
  body: Record<string, unknown>,
  origin: string,
): Promise<Response> {
  return app.request('/api/registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  })
}

async function findUserByEmail(
  db: TestDbContext['db'],
  email: string,
): Promise<{ id: string; accountStatus: string; requestedCompany: string | null } | undefined> {
  const [row] = await db
    .select({
      id: schema.users.id,
      accountStatus: schema.users.accountStatus,
      requestedCompany: schema.users.requestedCompany,
    })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)

  return row
}

describe.sequential('Registration module', () => {
  let ctx: TestDbContext
  let container: Container
  let eventBus: RecordingEventBus

  beforeEach(async () => {
    ctx = await createTestDbContext()
    eventBus = new RecordingEventBus()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('creates a pending user with the company hint, no roles, and emits SSE', async () => {
    // The sign-up commits via Better-Auth's own write path (shared connection),
    // so clear any leaked row from a previous run for determinism.
    await ctx.db.delete(schema.users).where(eq(schema.users.email, NEW_CLIENT_EMAIL))

    const app = createRegistrationTestApp(container)

    const response = await postRegistration(
      app,
      { name: 'Pera Perić', email: NEW_CLIENT_EMAIL, companyName: 'Bosch GmbH' },
      PORTAL_ORIGIN,
    )

    expect(response.status).toBe(202)

    const user = await findUserByEmail(ctx.db, NEW_CLIENT_EMAIL)
    expect(user).toBeDefined()
    expect(user?.accountStatus).toBe(UserAccountStatus.Pending)
    expect(user?.requestedCompany).toBe('Bosch GmbH')

    const roleRows = await ctx.db
      .select()
      .from(schema.userRoles)
      .where(eq(schema.userRoles.userId, user!.id))
    expect(roleRows).toHaveLength(0)

    expect(eventBus.resourceEvents.map((event) => event.resource)).toContain(
      ResourceChangedKey.Users,
    )
  })

  it('stays neutral for an already-registered email (no overwrite, no leak)', async () => {
    await ctx.db
      .insert(schema.users)
      .values({
        id: EXISTING_USER_ID,
        email: EXISTING_EMAIL,
        name: 'Postojeci Korisnik',
        accountStatus: UserAccountStatus.Approved,
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: { accountStatus: UserAccountStatus.Approved, requestedCompany: null },
      })

    const app = createRegistrationTestApp(container)

    const response = await postRegistration(
      app,
      { name: 'Napadač', email: EXISTING_EMAIL, companyName: 'Lažna Firma' },
      PORTAL_ORIGIN,
    )

    // Neutral success — never reveals that the account already exists.
    expect(response.status).toBe(202)

    const rows = await ctx.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, EXISTING_EMAIL))
    expect(rows).toHaveLength(1)

    const user = await findUserByEmail(ctx.db, EXISTING_EMAIL)
    // The existing account is untouched: status not reset, company not hijacked.
    expect(user?.accountStatus).toBe(UserAccountStatus.Approved)
    expect(user?.requestedCompany).toBeNull()
  })

  it('returns 403 from a disallowed origin and creates no user', async () => {
    await ctx.db.delete(schema.users).where(eq(schema.users.email, ORIGIN_BLOCK_EMAIL))

    const app = createRegistrationTestApp(container)

    const response = await postRegistration(
      app,
      { name: 'Blokiran', email: ORIGIN_BLOCK_EMAIL, companyName: 'Neka Firma' },
      FOREIGN_ORIGIN,
    )

    expect(response.status).toBe(403)
    expect(await findUserByEmail(ctx.db, ORIGIN_BLOCK_EMAIL)).toBeUndefined()
  })

  it('returns 400 for invalid input (missing company)', async () => {
    const app = createRegistrationTestApp(container)

    const response = await postRegistration(
      app,
      { name: 'Bez Firme', email: 'bez.firme@firma.rs' },
      PORTAL_ORIGIN,
    )

    expect(response.status).toBe(400)
  })
})

describe('client registration rate limiter', () => {
  it('rejects requests past the limit with 429', async () => {
    const app = new Hono()
    registerGlobalErrorHandler(app, fakeLogger())
    app.use('/api/registration', clientRegistrationRateLimiter)
    app.post('/api/registration', (c) => c.body(null, 202))

    const ip = '203.0.113.77'
    let sawRejection = false

    // Test-mode cap is 100; the request after the cap must be rejected.
    for (let i = 0; i < 130; i++) {
      const res = await app.request('/api/registration', {
        method: 'POST',
        headers: { 'x-forwarded-for': ip },
      })
      if (res.status === 429) {
        sawRejection = true
        break
      }
    }

    expect(sawRejection).toBe(true)
  })
})
