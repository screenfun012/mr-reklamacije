import { createDb as createDrizzleDb, createPool, schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import type { Env } from '../config/env.js'

export interface DbHandle {
  db: NodePgDatabase<typeof schema>
  pool: Pool
}

/**
 * A request waiting longer than this for a free connection is already a failed
 * request — better a clear error than a socket held open. The pool holds 10
 * connections (node-postgres default) while one statistics page issues 12 queries
 * at once, so saturation is reachable by concurrency alone, at any row count.
 */
const CONNECTION_TIMEOUT_MS = 5_000

/**
 * A statement running this long is a runaway, not a slow query: the app targets
 * p95 under 200 ms. Set generously so a large Excel export or a heavy statistics
 * aggregate is never the thing it kills — the connection timeout above is what
 * actually protects responsiveness.
 */
const STATEMENT_TIMEOUT_MS = 30_000

/** A transaction left open is a bug; without this it holds a connection forever. */
const IDLE_IN_TRANSACTION_TIMEOUT_MS = 60_000

/**
 * Creates pg Pool + Drizzle db for the API process.
 * Caller (server.ts) holds reference for graceful shutdown.
 *
 * Timeouts are set HERE and not in `createPool`, so the deploy migrator and the
 * one-off scripts keep unlimited time (docs/22 §1.1).
 */
export function createDb(env: Env): DbHandle {
  const pool = createPool(env.DATABASE_URL, {
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    statementTimeoutMillis: STATEMENT_TIMEOUT_MS,
    idleInTransactionTimeoutMillis: IDLE_IN_TRANSACTION_TIMEOUT_MS,
  })
  // No cast: createDb now builds the client WITH the schema, so its type is
  // the real relational db type (this used to `as unknown as` past a lying type).
  const db = createDrizzleDb(pool)
  return { db, pool }
}
