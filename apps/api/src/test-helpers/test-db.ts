import { createPool, schema } from '@mr/db'
import { drizzle } from 'drizzle-orm/node-postgres'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type pg from 'pg'

const DEFAULT_DATABASE_URL = 'postgresql://mr:mr_dev_password@localhost:5433/mr_reklamacije'

export interface TestDbContext {
  db: NodePgDatabase<typeof schema>
  pool: pg.Pool
  client: pg.PoolClient
  cleanup: () => Promise<void>
}

export async function createTestDbContext(): Promise<TestDbContext> {
  const connectionString = process.env['DATABASE_URL'] ?? DEFAULT_DATABASE_URL
  const pool = createPool(connectionString)
  const client = await pool.connect()

  await client.query('BEGIN')

  const db = drizzle(client, { schema }) as NodePgDatabase<typeof schema>

  return {
    db,
    pool,
    client,
    cleanup: async () => {
      await client.query('ROLLBACK')
      client.release()
      await pool.end()
    },
  }
}
