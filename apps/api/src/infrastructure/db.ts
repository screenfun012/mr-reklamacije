import { createDb as createDrizzleDb, createPool, schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import type { Env } from '../config/env.js'

export interface DbHandle {
  db: NodePgDatabase<typeof schema>
  pool: Pool
}

/**
 * Creates pg Pool + Drizzle db for the API process.
 * Caller (server.ts) holds reference for graceful shutdown.
 */
export function createDb(env: Env): DbHandle {
  const pool = createPool(env.DATABASE_URL)
  const db = createDrizzleDb(pool) as unknown as NodePgDatabase<typeof schema>
  return { db, pool }
}
