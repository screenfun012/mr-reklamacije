import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

/**
 * Returns `DATABASE_URL` from the current process environment.
 * Callers (e.g. `apps/api`) should load `.env` before importing this package.
 */
export function getDatabaseUrl(): string {
  const url = process.env['DATABASE_URL']
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is required')
  }
  return url
}

export interface PoolTimeouts {
  /**
   * How long a caller waits for a free connection before failing. node-postgres
   * defaults to 0 = wait forever, which turns a saturated pool into requests that
   * hang until the client gives up — with a green healthcheck and no restart.
   */
  connectionTimeoutMillis?: number
  /** Postgres aborts a statement that runs longer than this. Kills runaways. */
  statementTimeoutMillis?: number
  /**
   * Postgres closes a session left idle INSIDE a transaction. That is always a
   * bug, and without this it holds one of the (few) connections forever.
   */
  idleInTransactionTimeoutMillis?: number
}

/**
 * Creates a `pg` connection pool. Reads `DATABASE_URL` when `connectionString` is omitted.
 *
 * Timeouts are OPT-IN, deliberately. They belong on the request-serving path, not
 * on every pool: the deploy migrator (`migrate-deploy.ts`) and the one-off scripts
 * use this same factory, and a statement timeout there would abort a long index
 * build mid-migration and fail the deploy. See `apps/api/src/infrastructure/db.ts`
 * for the values the API runs with, and docs/22 §1.1 for why they exist.
 */
export function createPool(
  connectionString: string = getDatabaseUrl(),
  timeouts: PoolTimeouts = {},
): pg.Pool {
  return new pg.Pool({
    connectionString,
    ...(timeouts.connectionTimeoutMillis !== undefined
      ? { connectionTimeoutMillis: timeouts.connectionTimeoutMillis }
      : {}),
    ...(timeouts.statementTimeoutMillis !== undefined
      ? { statement_timeout: timeouts.statementTimeoutMillis }
      : {}),
    ...(timeouts.idleInTransactionTimeoutMillis !== undefined
      ? { idle_in_transaction_session_timeout: timeouts.idleInTransactionTimeoutMillis }
      : {}),
  })
}

/**
 * Drizzle client over a `pg` pool. Pass `schema` in Phase B when tables exist.
 */
export function createDb(pool: pg.Pool) {
  return drizzle(pool)
}
