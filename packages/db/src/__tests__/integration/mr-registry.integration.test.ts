import { normalizeMrKey } from '@mr/shared'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type pg from 'pg'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createDb, createPool } from '../../client.js'
import { getIntegrationDatabaseUrl } from '../../test-helpers/integration-db.js'
import * as schema from '../../schema/index.js'
import { sqlNormalizeMrKeyLiteral } from '../../sql/normalize-mr-key-sql.js'
import { domaceClaims, emotiveClaims, engineTypes, mrRegistry, users } from '../../schema/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const NORMALIZE_CASES: ReadonlyArray<{ input: string; expected: string }> = [
  { input: '  MR  5376 /  25  ', expected: 'mr 5376 / 25' },
  { input: 'Test\t123', expected: 'test 123' },
  { input: 'MR5376', expected: 'mr5376' },
  { input: '5376', expected: '5376' },
  { input: '  test 123  ', expected: 'test 123' },
]

const MR_REGISTRY_BACKFILL_SQL = sql`
  INSERT INTO mr_registry (mr_key, claim_kind, emotive_claim_id, domace_claim_id, created_at)
  SELECT
    lower(regexp_replace(trim(mr_number), '\\s+', ' ', 'g')) AS mr_key,
    'emotive'::text AS claim_kind,
    id AS emotive_claim_id,
    NULL::uuid AS domace_claim_id,
    created_at
  FROM emotive_claims
  WHERE deleted_at IS NULL
    AND mr_number IS NOT NULL
    AND trim(mr_number) <> ''
  UNION ALL
  SELECT
    lower(regexp_replace(trim(mr_number), '\\s+', ' ', 'g')) AS mr_key,
    'domace'::text AS claim_kind,
    NULL::uuid AS emotive_claim_id,
    id AS domace_claim_id,
    created_at
  FROM domace_claims
  WHERE deleted_at IS NULL
    AND mr_number IS NOT NULL
    AND trim(mr_number) <> ''
`

let pool: pg.Pool
let migrateDb: ReturnType<typeof createDb>
let client: pg.PoolClient
let db: NodePgDatabase<typeof schema>

beforeAll(async () => {
  pool = createPool(getIntegrationDatabaseUrl())
  migrateDb = createDb(pool)

  await migrate(migrateDb, {
    migrationsFolder: resolve(__dirname, '../../../migrations'),
  })
})

beforeEach(async () => {
  client = await pool.connect()
  await client.query('BEGIN')
  db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>
  // Isolated fixture — rolled back after each test; does not mutate committed dev rows.
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

describe('sqlNormalizeMrKeyLiteral', () => {
  it.each(NORMALIZE_CASES)('matches normalizeMrKey for $input', async ({ input, expected }) => {
    expect(normalizeMrKey(input)).toBe(expected)

    const result = await db.execute<{ mr_key: string }>(
      sql`SELECT ${sqlNormalizeMrKeyLiteral(input)} AS mr_key`,
    )
    const row = result.rows[0]
    expect(row?.mr_key).toBe(expected)
  })

  it('returns null-equivalent for empty input in TS only', () => {
    expect(normalizeMrKey('   ')).toBeNull()
  })
})

describe('mr_registry migration backfill', () => {
  it('backfills one registry row per active claim with normalized mr_key', async () => {
    const [user] = await db
      .insert(users)
      .values({ email: 'mr-registry-test@example.com', name: 'MR Registry Test' })
      .returning()
    const [engine] = await db
      .insert(engineTypes)
      .values({ code: 'MR_REG_ENGINE', manufacturer: 'Test' })
      .returning()

    expect(user?.id).toBeDefined()
    expect(engine?.id).toBeDefined()

    await db.insert(emotiveClaims).values([
      {
        engineTypeId: engine!.id,
        dateOfClaim: new Date('2026-06-01'),
        mrNumber: '  EM-1/26  ',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      },
      {
        engineTypeId: engine!.id,
        dateOfClaim: new Date('2026-06-02'),
        mrNumber: 'EM-2/26',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      },
    ])

    await db.insert(domaceClaims).values([
      {
        mrNumber: 'DO-1/26',
        customerName: 'Kupac',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      },
      {
        mrNumber: null,
        customerName: 'Bez MR',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      },
    ])

    await db.execute(MR_REGISTRY_BACKFILL_SQL)

    const rows = await db.select().from(mrRegistry)
    expect(rows).toHaveLength(3)
    expect(rows.some((row) => row.mrKey === 'em-1/26')).toBe(true)
    expect(rows.some((row) => row.mrKey === 'em-2/26')).toBe(true)
    expect(rows.some((row) => row.mrKey === 'do-1/26')).toBe(true)
  })

  it('rejects duplicate mr_key inserts', async () => {
    const [user] = await db
      .insert(users)
      .values({ email: 'mr-registry-dup@example.com', name: 'MR Dup Test' })
      .returning()
    const [engine] = await db
      .insert(engineTypes)
      .values({ code: 'MR_REG_ENGINE_DUP', manufacturer: 'Test' })
      .returning()

    const [emotive] = await db
      .insert(emotiveClaims)
      .values({
        engineTypeId: engine!.id,
        dateOfClaim: new Date('2026-06-01'),
        mrNumber: 'DUP/26',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      })
      .returning()
    const [domace] = await db
      .insert(domaceClaims)
      .values({
        mrNumber: 'OTHER/26',
        customerName: 'Kupac',
        outcome: 'pending',
        claimYear: 2026,
        createdBy: user!.id,
      })
      .returning()

    await db.insert(mrRegistry).values({
      mrKey: 'dup/26',
      claimKind: 'emotive',
      emotiveClaimId: emotive!.id,
      domaceClaimId: null,
    })

    await expect(
      db.insert(mrRegistry).values({
        mrKey: 'dup/26',
        claimKind: 'domace',
        emotiveClaimId: null,
        domaceClaimId: domace!.id,
      }),
    ).rejects.toThrow()
  })
})
