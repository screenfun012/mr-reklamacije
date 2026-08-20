import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import * as schema from '../../schema/index.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

let pool: pg.Pool
let client: pg.PoolClient
let db: NodePgDatabase<typeof schema>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  await migrate(createDb(pool), {
    migrationsFolder: resolve(__dirname, '../../../migrations'),
  })
})

// Transaction-per-test: real isolation, no TRUNCATE, no dependency on another
// suite's (or the demo seed's) data surviving — the demo seed itself skips
// silently when no admin user exists, which is this test database's normal
// state (CLAUDE.md §8 known drift: suites must seed their own prerequisites).
beforeEach(async () => {
  client = await pool.connect()
  await client.query('BEGIN')
  db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>
})

afterEach(async () => {
  await client.query('ROLLBACK')
  client.release()
})

afterAll(async () => {
  await pool.end()
})

describe('migration 0045 — claim categories', () => {
  it('ships the four categories the meeting agreed on, in order', async () => {
    const result = await db.execute<{ code: string; name: string; sort_order: number }>(
      sql`SELECT code, name, sort_order FROM claim_categories ORDER BY sort_order`,
    )

    expect(result.rows.map((row) => row.code)).toEqual([
      'REMONT_MOTORA',
      'MASINSKA_OBRADA',
      'NOVI_DELOVI',
      'AUTO_SERVIS',
    ])
  })

  it('refuses to delete a category a claim still points at', async () => {
    const category = await db.execute<{ id: string }>(
      sql`SELECT id FROM claim_categories WHERE code = 'REMONT_MOTORA'`,
    )
    const categoryId = category.rows[0]?.id

    const userId = randomUUID()
    await db.insert(schema.users).values({
      id: userId,
      email: `claim-category-${userId}@mrengines.rs`,
      name: 'Claim Category Test',
    })
    await db.insert(schema.domaceClaims).values({
      customerName: 'Claim Category Kupac',
      outcome: 'pending',
      claimYear: 2026,
      createdBy: userId,
      categoryId,
    })

    await expect(
      db.execute(sql`DELETE FROM claim_categories WHERE id = ${categoryId}`),
    ).rejects.toThrow()
  })
})
