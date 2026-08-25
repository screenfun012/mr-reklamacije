import { createAuth } from '../../better-auth.config.js'
import { createDb, createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { UserAccountStatus } from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PASSWORD = 'SessionLimit2026!'

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

/** Sets a session renewal time, so the order the rule reads is not left to chance. */
async function markLastUsed(userId: string, device: string, minutesAgo: number): Promise<void> {
  await db
    .update(schema.sessions)
    .set({ updatedAt: new Date(Date.now() - minutesAgo * 60_000) })
    .where(and(eq(schema.sessions.userId, userId), eq(schema.sessions.userAgent, device)))
}

describe('how many sessions one account may keep active (integration)', () => {
  /**
   * The strict one-session policy signed the previous browser out on every new login. Five
   * concurrent sessions keep a person signed in on their regular browser contexts without turning
   * a stolen password into an unlimited set of live sessions.
   */
  it('keeps five active sessions at once', async () => {
    const email = `session-limit-${Date.now()}@example.com`
    const userId = await createApprovedUser(email, 'Five Sessions')

    await signInFrom(email, 'telefon')
    await signInFrom(email, 'tablet')
    await signInFrom(email, 'racunar')
    await signInFrom(email, 'admin-racunar')
    await signInFrom(email, 'rezervni-pregledac')

    const sessions = await db
      .select({ userAgent: schema.sessions.userAgent })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))

    expect(sessions).toHaveLength(5)
    expect(sessions.map((row) => row.userAgent).sort()).toEqual([
      'admin-racunar',
      'racunar',
      'rezervni-pregledac',
      'tablet',
      'telefon',
    ])
  })

  it('evicts the oldest session on the sixth login and keeps the new one', async () => {
    const email = `session-limit-lru-${Date.now()}@example.com`
    const userId = await createApprovedUser(email, 'Six Sessions')

    await signInFrom(email, 'telefon')
    await signInFrom(email, 'tablet')
    await signInFrom(email, 'racunar')
    await signInFrom(email, 'admin-racunar')
    await signInFrom(email, 'rezervni-pregledac')

    /*
     * ⚠ Logins a millisecond apart would leave the order to chance, and what is under test here is
     * precisely the order. So each session is given a distinct renewal time. The phone is oldest;
     * the sixth login must evict it and never itself.
     */
    await markLastUsed(userId, 'telefon', 150)
    await markLastUsed(userId, 'tablet', 120)
    await markLastUsed(userId, 'racunar', 90)
    await markLastUsed(userId, 'admin-racunar', 60)
    await markLastUsed(userId, 'rezervni-pregledac', 30)

    await signInFrom(email, 'sesti-pregledac')

    const sessions = await db
      .select({ userAgent: schema.sessions.userAgent })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))

    expect(sessions).toHaveLength(5)
    // The new session survives — deleting it would sign a person out by logging them in.
    expect(sessions.map((row) => row.userAgent).sort()).toEqual([
      'admin-racunar',
      'racunar',
      'rezervni-pregledac',
      'sesti-pregledac',
      'tablet',
    ])
  })

  it('keeps the new session and the cap when existing renewal times are ahead', async () => {
    const email = `session-limit-tie-${Date.now()}@example.com`
    const userId = await createApprovedUser(email, 'Clock Skew')

    await signInFrom(email, 'telefon')
    await signInFrom(email, 'tablet')
    await signInFrom(email, 'racunar')
    await signInFrom(email, 'admin-racunar')
    await signInFrom(email, 'rezervni-pregledac')

    // A database/app clock skew must not let the just-created sixth session escape the cap.
    await db
      .update(schema.sessions)
      .set({ updatedAt: new Date(Date.now() + 60_000) })
      .where(eq(schema.sessions.userId, userId))

    await signInFrom(email, 'sesti-pregledac')

    const sessions = await db
      .select({ userAgent: schema.sessions.userAgent })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))

    expect(sessions).toHaveLength(5)
    expect(sessions.map((row) => row.userAgent)).toContain('sesti-pregledac')
  })

  it('keeps the cap when two new browsers sign in at the same time', async () => {
    const email = `session-limit-race-${Date.now()}@example.com`
    const userId = await createApprovedUser(email, 'Concurrent Sessions')

    await signInFrom(email, 'telefon')
    await signInFrom(email, 'tablet')
    await signInFrom(email, 'racunar')
    await signInFrom(email, 'admin-racunar')
    await signInFrom(email, 'rezervni-pregledac')
    await Promise.all([signInFrom(email, 'sesti-pregledac'), signInFrom(email, 'sedmi-pregledac')])

    const sessions = await db
      .select({ userAgent: schema.sessions.userAgent })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))

    expect(sessions).toHaveLength(5)
    expect(sessions.map((row) => row.userAgent)).toEqual(
      expect.arrayContaining(['sesti-pregledac', 'sedmi-pregledac']),
    )
  })

  it('does not revoke a different user\u2019s session', async () => {
    const emailA = `session-limit-a-${Date.now()}@example.com`
    const emailB = `session-limit-b-${Date.now()}@example.com`
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
