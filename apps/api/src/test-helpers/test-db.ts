import { assertIntegrationDatabase, createPool, getIntegrationDatabaseUrl, schema } from '@mr/db'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type pg from 'pg'

export interface TestDbContext {
  db: NodePgDatabase<typeof schema>
  pool: pg.Pool
  client: pg.PoolClient
  databaseUrl: string
  cleanup: () => Promise<void>
}

/** The only way out of a Drizzle transaction callback that must not commit. */
class RollbackSignal extends Error {
  constructor() {
    super('test transaction rolled back')
    this.name = 'RollbackSignal'
  }
}

/**
 * One test, one transaction, always rolled back.
 *
 * The transaction is opened through Drizzle rather than by sending `BEGIN` down the client
 * ourselves, and that is the whole point. Drizzle has no idea about SQL it did not issue, so a
 * repository calling `db.transaction(...)` inside a hand-rolled `BEGIN` used to open a second one
 * — Postgres treats the nested `BEGIN` as a no-op warning and the matching `COMMIT` then commits
 * the OUTER transaction. Everything the test had written up to that point was persisted and the
 * final `ROLLBACK` had nothing left to undo. Measured 2026-07-27: 13 users and 70 intake orders
 * survived every run of one suite, which eventually pushed a fixture in an unrelated suite off the
 * first page of a paginated list and failed it.
 *
 * Handing out Drizzle's own transaction object makes any nested `transaction()` a SAVEPOINT, which
 * is what a repository expects and what keeps the test sealed.
 */
export async function createTestDbContext(): Promise<TestDbContext> {
  const connectionString = getIntegrationDatabaseUrl()
  assertIntegrationDatabase(connectionString)

  const pool = createPool(connectionString)
  const client = await pool.connect()
  const root = drizzle(client, { schema }) as NodePgDatabase<typeof schema>

  let db!: NodePgDatabase<typeof schema>
  let endTest!: () => void
  let opened!: () => void
  const ready = new Promise<void>((resolve) => {
    opened = resolve
  })

  // Held open for the lifetime of the test; `cleanup` releases it and the throw rolls it back.
  const running = root
    .transaction(async (tx) => {
      db = tx as unknown as NodePgDatabase<typeof schema>
      opened()
      await new Promise<void>((resolve) => {
        endTest = resolve
      })
      throw new RollbackSignal()
    })
    .catch((error: unknown) => {
      if (!(error instanceof RollbackSignal)) {
        throw error
      }
    })

  await ready

  return {
    db,
    pool,
    client,
    databaseUrl: connectionString,
    cleanup: async () => {
      endTest()
      // Wait for the rollback to actually unwind before the connection goes back to the pool.
      await running
      client.release()
      await pool.end()
    },
  }
}
