import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import { backfillMrRegistry } from '../../maintenance/backfill-mr-registry.js'
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

beforeEach(async () => {
  client = await pool.connect()
  await client.query('BEGIN')
  db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>
  await db.execute(
    sql`TRUNCATE TABLE mr_registry, domace_claims, emotive_claims RESTART IDENTITY CASCADE`,
  )
})

afterEach(async () => {
  await client.query('ROLLBACK')
  client.release()
})

afterAll(async () => {
  await pool.end()
})

describe('backfillMrRegistry', () => {
  it('registers directly-inserted claims (legacy-import path) and stays idempotent', async () => {
    const userId = randomUUID()
    await db.insert(schema.users).values({
      id: userId,
      email: `backfill-${userId}@mrengines.rs`,
      name: 'Backfill Test',
    })
    const [engineType] = await db
      .insert(schema.engineTypes)
      .values({ code: `BF-${userId.slice(0, 8)}` })
      .returning({ id: schema.engineTypes.id })

    // Direct insert — bypasses MrRegistryService.claimMr exactly like the
    // legacy import did (2026-07-17 incident: registry held 3 of 127 numbers).
    const [claim] = await db
      .insert(schema.emotiveClaims)
      .values({
        engineTypeId: engineType!.id,
        dateOfClaim: new Date('2026-01-15'),
        mrNumber: '  BF  7167 /25 ',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: userId,
      })
      .returning({ id: schema.emotiveClaims.id })

    const inserted = await backfillMrRegistry(db)
    expect(inserted).toBe(1)

    // Normalized exactly like normalizeMrKey: trim, collapse whitespace, lowercase.
    const [row] = await db
      .select()
      .from(schema.mrRegistry)
      .where(eq(schema.mrRegistry.emotiveClaimId, claim!.id))
    expect(row?.mrKey).toBe('bf 7167 /25')
    expect(row?.claimKind).toBe('emotive')

    // Second run inserts nothing (idempotent); soft-deleted claims stay out.
    expect(await backfillMrRegistry(db)).toBe(0)
  })

  it('skips soft-deleted and empty-number claims', async () => {
    const userId = randomUUID()
    await db.insert(schema.users).values({
      id: userId,
      email: `backfill-skip-${userId}@mrengines.rs`,
      name: 'Backfill Skip Test',
    })

    await db.insert(schema.domaceClaims).values({
      customerName: 'Backfill Kupac',
      mrNumber: '9999/26',
      outcome: 'pending',
      claimYear: 2026,
      createdBy: userId,
      deletedAt: new Date(),
    })
    await db.insert(schema.domaceClaims).values({
      customerName: 'Backfill Kupac 2',
      mrNumber: '   ',
      outcome: 'pending',
      claimYear: 2026,
      createdBy: userId,
    })

    expect(await backfillMrRegistry(db)).toBe(0)
    const rows = await db.select().from(schema.mrRegistry)
    expect(rows).toHaveLength(0)
  })
})
