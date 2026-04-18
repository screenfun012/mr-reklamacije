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

/**
 * Creates a `pg` connection pool. Reads `DATABASE_URL` when `connectionString` is omitted.
 */
export function createPool(connectionString: string = getDatabaseUrl()): pg.Pool {
  return new pg.Pool({ connectionString })
}

/**
 * Drizzle client over a `pg` pool. Pass `schema` in Phase B when tables exist.
 */
export function createDb(pool: pg.Pool) {
  return drizzle(pool)
}
