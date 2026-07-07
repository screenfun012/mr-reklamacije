import type pg from 'pg'

/**
 * Postgres extensions installed BEFORE migrations run — citext is used by
 * migration 0000, so this cannot live in a migration file. uuid-ossp,
 * pgcrypto and pg_trgm are not (yet) referenced by any migration but are
 * kept in parity with what the integration setup has always installed.
 * Used by the deploy migrator and the integration setup.
 */
export const REQUIRED_EXTENSION_STATEMENTS = [
  'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
  'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
  'CREATE EXTENSION IF NOT EXISTS "citext"',
  'CREATE EXTENSION IF NOT EXISTS "pg_trgm"',
] as const

export async function ensureRequiredExtensions(pool: pg.Pool): Promise<void> {
  for (const statement of REQUIRED_EXTENSION_STATEMENTS) {
    await pool.query(statement)
  }
}
