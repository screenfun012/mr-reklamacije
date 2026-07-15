import { createAuth } from '../../better-auth.config.js'
import { AUTH_ERROR_ACCOUNT_DEACTIVATED } from '../../auth-error-codes.js'
import { createDb, createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { UserAccountStatus } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

const EMAIL = `deactivated-signin-${Date.now()}@example.com`
const PASSWORD = 'TestDeactivated2026!'

let pool: ReturnType<typeof createPool>
let db: NodePgDatabase<typeof schema>
let auth: ReturnType<typeof createAuth>
let userId: string

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  db = createDb(pool) as unknown as NodePgDatabase<typeof schema>
  auth = createAuth(db, { trustedOrigins: ['http://localhost:3002'] })

  await migrate(db, {
    migrationsFolder: resolve(__dirname, '../../../../db/migrations'),
  })

  const signUp = await auth.api.signUpEmail({
    body: { email: EMAIL, password: PASSWORD, name: 'Deactivated Worker' },
    headers: new Headers(),
  })
  userId = signUp.user!.id

  // Approve so the account-status gate passes and only is_active is under test.
  await db
    .update(schema.users)
    .set({ accountStatus: UserAccountStatus.Approved })
    .where(eq(schema.users.id, userId))
})

afterAll(async () => {
  await pool?.end()
})

describe('is_active sign-in (integration)', () => {
  it('blocks a deactivated user at session.create.before — no session row created', async () => {
    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, userId))

    await expect(
      auth.api.signInEmail({
        body: { email: EMAIL, password: PASSWORD },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({ message: AUTH_ERROR_ACCOUNT_DEACTIVATED })

    const sessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))

    expect(sessions).toHaveLength(0)
  })

  it('allows the same user to sign in once reactivated', async () => {
    await db.update(schema.users).set({ isActive: true }).where(eq(schema.users.id, userId))

    const signIn = await auth.api.signInEmail({
      body: { email: EMAIL, password: PASSWORD },
      headers: new Headers(),
    })

    expect(signIn.user?.id).toBe(userId)

    const sessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))

    expect(sessions.length).toBeGreaterThan(0)
  })
})
