import { createAuth } from '../../better-auth.config.js'
import { AUTH_ERROR_ACCOUNT_PENDING } from '../../auth-error-codes.js'
import { createDb, createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { UserAccountStatus } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PENDING_EMAIL = `pending-signin-${Date.now()}@example.com`
const PENDING_PASSWORD = 'TestPending2026!'

let pool: ReturnType<typeof createPool>
let db: NodePgDatabase<typeof schema>
let auth: ReturnType<typeof createAuth>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  db = createDb(pool) as unknown as NodePgDatabase<typeof schema>
  auth = createAuth(db, { trustedOrigins: ['http://localhost:3002'] })

  await migrate(db, {
    migrationsFolder: resolve(__dirname, '../../../../db/migrations'),
  })
})

afterAll(async () => {
  await pool?.end()
})

describe('account_status sign-in (integration)', () => {
  it('blocks pending user at session.create.before — no session row created', async () => {
    const signUp = await auth.api.signUpEmail({
      body: {
        email: PENDING_EMAIL,
        password: PENDING_PASSWORD,
        name: 'Pending Worker',
      },
      headers: new Headers(),
    })

    expect(signUp.user?.id).toBeDefined()

    const [userRow] = await db
      .select({ accountStatus: schema.users.accountStatus })
      .from(schema.users)
      .where(eq(schema.users.email, PENDING_EMAIL))
      .limit(1)

    expect(userRow?.accountStatus).toBe(UserAccountStatus.Pending)

    await expect(
      auth.api.signInEmail({
        body: {
          email: PENDING_EMAIL,
          password: PENDING_PASSWORD,
        },
        headers: new Headers(),
      }),
    ).rejects.toMatchObject({
      message: AUTH_ERROR_ACCOUNT_PENDING,
    })

    const sessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, signUp.user!.id))

    expect(sessions).toHaveLength(0)
  })
})
