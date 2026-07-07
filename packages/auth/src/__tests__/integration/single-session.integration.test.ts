import { createAuth } from '../../better-auth.config.js'
import { createDb, createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { UserAccountStatus } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PASSWORD = 'SingleSession2026!'

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

async function createApprovedUser(email: string, name: string): Promise<string> {
  const signUp = await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name },
    headers: new Headers(),
  })
  await db
    .update(schema.users)
    .set({ accountStatus: UserAccountStatus.Approved })
    .where(eq(schema.users.id, signUp.user!.id))
  return signUp.user!.id
}

async function signInFrom(email: string, device: string): Promise<void> {
  await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    headers: new Headers({ 'user-agent': device }),
  })
}

describe('single active session (integration)', () => {
  it('a fresh login revokes the user’s other sessions but keeps the new one', async () => {
    const email = `single-session-${Date.now()}@example.com`
    const userId = await createApprovedUser(email, 'Device Hopper')

    await signInFrom(email, 'device-a')
    await signInFrom(email, 'device-b')

    const sessions = await db
      .select({ id: schema.sessions.id, userAgent: schema.sessions.userAgent })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))

    // Strict single-device: device-a revoked, device-b (newest login) survives.
    // The surviving row proves the just-created session is never deleted — the
    // admin-lockout guard.
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.userAgent).toBe('device-b')
  })

  it('does not revoke a different user’s session', async () => {
    const emailA = `single-session-a-${Date.now()}@example.com`
    const emailB = `single-session-b-${Date.now()}@example.com`
    const userA = await createApprovedUser(emailA, 'User A')
    const userB = await createApprovedUser(emailB, 'User B')

    await signInFrom(emailA, 'a-device')
    await signInFrom(emailB, 'b-device')

    const aSessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userA))
    const bSessions = await db
      .select({ id: schema.sessions.id })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userB))

    // B signing in must not touch A's session.
    expect(aSessions).toHaveLength(1)
    expect(bSessions).toHaveLength(1)
  })
})
