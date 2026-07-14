import { createAuth } from '../../better-auth.config.js'
import { createDb, createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { AuditAction, UserAccountStatus } from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PASSWORD = 'LoginIpSource2026!'

// Real client IP as Cloudflare would append it; the leftmost x-forwarded-for
// entry is attacker-controlled and must NEVER be recorded.
const REAL_IP = '203.0.113.7'
const FORGED_IP = '8.8.8.8'

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

describe('login IP source (integration)', () => {
  it('records cf-connecting-ip, not a forged leftmost x-forwarded-for', async () => {
    const email = `login-ip-source-${Date.now()}@example.com`
    const userId = await createApprovedUser(email, 'Forged Header')

    await auth.api.signInEmail({
      body: { email, password: PASSWORD },
      // Attacker prepends a forged IP to the LEFT; Cloudflare's real IP is on
      // the right, and also present (unforgeably) in cf-connecting-ip.
      headers: new Headers({
        'x-forwarded-for': `${FORGED_IP}, ${REAL_IP}`,
        'cf-connecting-ip': REAL_IP,
      }),
    })

    const [session] = await db
      .select({ ipAddress: schema.sessions.ipAddress })
      .from(schema.sessions)
      .where(eq(schema.sessions.userId, userId))
      .limit(1)

    // The session must record the unforgeable cf-connecting-ip, never the
    // forged leftmost x-forwarded-for entry.
    expect(session?.ipAddress).toBe(REAL_IP)
    expect(session?.ipAddress).not.toBe(FORGED_IP)

    const [audit] = await db
      .select({ actorIp: schema.auditLog.actorIp })
      .from(schema.auditLog)
      .where(
        and(eq(schema.auditLog.actorUserId, userId), eq(schema.auditLog.action, AuditAction.Login)),
      )
      .limit(1)

    // The Login audit row's actorIp is copied from session.ipAddress — same guarantee.
    expect(audit?.actorIp).toBe(REAL_IP)
    expect(audit?.actorIp).not.toBe(FORGED_IP)
  })
})
