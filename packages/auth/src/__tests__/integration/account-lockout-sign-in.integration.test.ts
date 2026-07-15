import { createAuth } from '../../better-auth.config.js'
import { AUTH_ERROR_ACCOUNT_LOCKED } from '../../auth-error-codes.js'
import { createDb, createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { UserAccountStatus } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PASSWORD = 'TestLockout2026!'
const WRONG_PASSWORD = 'wrong-password-000'

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

async function makeApprovedUser(email: string): Promise<void> {
  const signUp = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: 'Lockout Test' },
    headers: new Headers(),
  })
  await db
    .update(schema.users)
    .set({ accountStatus: UserAccountStatus.Approved })
    .where(eq(schema.users.id, signUp.user!.id))
}

function signIn(email: string, password: string): Promise<unknown> {
  return auth.api.signInEmail({ body: { email, password }, headers: new Headers() })
}

describe('account lockout on sign-in (integration)', () => {
  it('locks after 5 failed attempts — the correct password is then refused with ACCOUNT_LOCKED', async () => {
    const email = `lockout-a-${Date.now()}@example.com`
    await makeApprovedUser(email)

    for (let i = 0; i < 5; i += 1) {
      await expect(signIn(email, WRONG_PASSWORD)).rejects.toBeDefined()
    }

    // Even the correct password is now blocked at the before-hook (per-account lock).
    await expect(signIn(email, PASSWORD)).rejects.toMatchObject({
      message: AUTH_ERROR_ACCOUNT_LOCKED,
    })
  })

  it('a successful login clears the counter — a later single failure does not lock', async () => {
    const email = `lockout-b-${Date.now()}@example.com`
    await makeApprovedUser(email)

    for (let i = 0; i < 4; i += 1) {
      await expect(signIn(email, WRONG_PASSWORD)).rejects.toBeDefined()
    }

    const ok = (await signIn(email, PASSWORD)) as { user?: { id?: string } }
    expect(ok.user?.id).toBeDefined()

    // Counter was cleared by the success — one more failure must not lock.
    await expect(signIn(email, WRONG_PASSWORD)).rejects.toBeDefined()
    const okAgain = (await signIn(email, PASSWORD)) as { user?: { id?: string } }
    expect(okAgain.user?.id).toBeDefined()
  })

  it('strips the raw session token from the sign-in success body (defense in depth)', async () => {
    const email = `lockout-c-${Date.now()}@example.com`
    await makeApprovedUser(email)

    const res = (await signIn(email, PASSWORD)) as Record<string, unknown>
    expect((res['user'] as { id?: string } | undefined)?.id).toBeDefined()
    expect(res['token']).toBeUndefined()
  })
})
