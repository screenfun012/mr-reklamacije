/**
 * Registers every active claim's MR number in `mr_registry`.
 *
 * The registry is what makes a duplicate MR number impossible and what the create
 * form's warning reads. A claim written through the app registers its number in the
 * same transaction, so the two can never drift — but a claim inserted DIRECTLY does
 * not, and that has happened: on 2026-07-17 production held 3 of 127 numbers, and
 * Nikola created a duplicate `7167/25` with no warning and no 409. That hole was
 * closed twice — the numbers were backfilled, and `import-legacy` now backfills at
 * the end of every apply — but the maintenance function had no way to be run on its
 * own. This is that way.
 *
 * Safe to run at any time: `ON CONFLICT (mr_key) DO NOTHING`, so a second run inserts
 * nothing. A deleted claim stays unregistered on purpose — releasing its number is
 * the design, not a gap.
 *
 * Dry run by default (does the work in a transaction, reports, then rolls back — so
 * the number it prints is the number `--apply` will write, not an estimate):
 *   pnpm --filter api backfill-mr-registry
 *   pnpm --filter api backfill-mr-registry -- --apply
 *
 * Reads DATABASE_URL from apps/api/.env (dev) or the process env (Railway one-off shell).
 */
import { fileURLToPath } from 'node:url'

// Tolerate a missing .env — in production config comes from the process env.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
} catch {
  // no .env file — fine
}

import { backfillMrRegistry, schema } from '@mr/db'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

/** Thrown to roll a dry run back. Never escapes this file. */
class DryRunRollback extends Error {
  constructor(readonly inserted: number) {
    super('dry run')
  }
}

async function countRegistered(db: {
  execute: (query: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }>
}): Promise<number> {
  const result = await db.execute(sql`SELECT count(*)::int AS n FROM mr_registry`)
  return Number(result.rows[0]?.['n'] ?? 0)
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const databaseUrl = process.env['DATABASE_URL']
  if (databaseUrl === undefined || databaseUrl === '') {
    throw new Error('DATABASE_URL is not set')
  }

  const pool = new pg.Pool({ connectionString: databaseUrl })
  const db = drizzle(pool, { schema })

  try {
    const before = await countRegistered(db)
    let inserted: number

    if (apply) {
      inserted = await backfillMrRegistry(db)
    } else {
      try {
        await db.transaction(async (tx) => {
          const count = await backfillMrRegistry(tx)
          // The only way to learn the real number without writing it.
          throw new DryRunRollback(count)
        })
        inserted = 0
      } catch (error) {
        if (!(error instanceof DryRunRollback)) {
          throw error
        }
        inserted = error.inserted
      }
    }

    const after = await countRegistered(db)
    console.log(`mr_registry: ${before} rows before`)
    console.log(`${apply ? 'inserted' : 'would insert'}: ${inserted}`)
    console.log(`mr_registry: ${after} rows after`)
    if (!apply && inserted > 0) {
      console.log('\nNothing was written. Re-run with `-- --apply` to write it.')
    }
    if (!apply && inserted === 0) {
      console.log('\nNothing missing — every active claim with an MR number is registered.')
    }
  } finally {
    await pool.end()
  }
}

await main()
