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

export async function createTestDbContext(): Promise<TestDbContext> {
  const connectionString = getIntegrationDatabaseUrl()
  assertIntegrationDatabase(connectionString)

  const pool = createPool(connectionString)
  const client = await pool.connect()

  await client.query('BEGIN')

  const db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>

  return {
    db,
    pool,
    client,
    databaseUrl: connectionString,
    cleanup: async () => {
      await client.query('ROLLBACK')
      client.release()
      await pool.end()
    },
  }
}
