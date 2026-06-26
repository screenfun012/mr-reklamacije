import { eq, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { UserAccountStatus } from '@mr/shared'

import { createDb, createPool } from '../../client.js'
import { users } from '../../schema/index.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = resolve(__dirname, '../../../migrations')

let pool: ReturnType<typeof createPool>
let db: ReturnType<typeof createDb>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  db = createDb(pool)

  await migrate(db, { migrationsFolder })

  await db.execute(sql`TRUNCATE TABLE users RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await pool.end()
})

describe('users.account_status (integration)', () => {
  it('migration backfills existing rows to approved (Nikola-safe)', () => {
    const migrationSql = readFileSync(
      resolve(migrationsFolder, '0016_user_account_status.sql'),
      'utf8',
    )
    expect(migrationSql).toContain(`UPDATE "users" SET "account_status" = 'approved'`)
  })

  it('defaults new users to pending', async () => {
    const [row] = await db
      .insert(users)
      .values({
        email: `pending-default-${Date.now()}@example.com`,
        name: 'Pending Default',
      })
      .returning()

    expect(row?.accountStatus).toBe(UserAccountStatus.Pending)
  })

  it('accepts approved and rejected statuses', async () => {
    const [approved] = await db
      .insert(users)
      .values({
        email: `approved-${Date.now()}@example.com`,
        name: 'Approved User',
        accountStatus: UserAccountStatus.Approved,
      })
      .returning()

    const [rejected] = await db
      .insert(users)
      .values({
        email: `rejected-${Date.now()}@example.com`,
        name: 'Rejected User',
        accountStatus: UserAccountStatus.Rejected,
      })
      .returning()

    expect(approved?.accountStatus).toBe(UserAccountStatus.Approved)
    expect(rejected?.accountStatus).toBe(UserAccountStatus.Rejected)
  })

  it('rejects invalid account_status via CHECK constraint', async () => {
    await expect(
      db.insert(users).values({
        email: `invalid-status-${Date.now()}@example.com`,
        name: 'Invalid Status',
        accountStatus: 'banned' as never,
      }),
    ).rejects.toThrow()
  })

  it('simulates pre-migration user row becoming approved after backfill SQL', async () => {
    const email = `legacy-admin-${Date.now()}@example.com`

    await db.execute(sql`
      INSERT INTO users (email, name, account_status)
      VALUES (${email}, 'Legacy Admin', ${UserAccountStatus.Pending})
    `)

    await db.execute(sql`UPDATE users SET account_status = 'approved'`)

    const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1)
    expect(row?.accountStatus).toBe(UserAccountStatus.Approved)
  })
})
