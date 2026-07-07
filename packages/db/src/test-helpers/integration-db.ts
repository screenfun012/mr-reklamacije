import { createPool } from '../client.js'
import { ensureRequiredExtensions } from '../extensions.js'

/** Dev database name — integration tests must never connect here. */
export const DEV_DATABASE_NAME = 'mr_reklamacije'

export const DEFAULT_TEST_DATABASE_URL =
  'postgresql://mr:mr_dev_password@localhost:5433/mr_reklamacije_test'

export function parseDatabaseName(connectionString: string): string {
  let parsed: URL
  try {
    parsed = new URL(connectionString)
  } catch {
    throw new Error('assertIntegrationDatabase: invalid database URL')
  }

  const name = parsed.pathname.replace(/^\//, '')
  if (name === '') {
    throw new Error('assertIntegrationDatabase: database name missing from URL path')
  }

  return name
}

/**
 * Refuses dev (and any non-*_test) database URLs. Call at the start of every
 * integration test entry point so TRUNCATE/migrate/seed cannot hit dev data.
 */
export function assertIntegrationDatabase(connectionString: string): void {
  const dbName = parseDatabaseName(connectionString)

  if (dbName === DEV_DATABASE_NAME) {
    throw new Error(
      `Integration tests refused dev database "${DEV_DATABASE_NAME}". ` +
        `Set TEST_DATABASE_URL to a *_test database (default: ${DEFAULT_TEST_DATABASE_URL}).`,
    )
  }

  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Integration tests must use a *_test database, refused "${dbName}". ` +
        `Set TEST_DATABASE_URL (default: ${DEFAULT_TEST_DATABASE_URL}).`,
    )
  }
}

/** Resolved test DB URL: TEST_DATABASE_URL env, else default *_test URL. */
export function getIntegrationDatabaseUrl(): string {
  const fromEnv = process.env['TEST_DATABASE_URL']
  const url =
    fromEnv !== undefined && fromEnv.trim() !== '' ? fromEnv.trim() : DEFAULT_TEST_DATABASE_URL

  assertIntegrationDatabase(url)
  return url
}

export async function ensureIntegrationDatabaseExists(testDatabaseUrl: string): Promise<void> {
  assertIntegrationDatabase(testDatabaseUrl)

  const testDbName = parseDatabaseName(testDatabaseUrl)
  const adminUrl = new URL(testDatabaseUrl)
  adminUrl.pathname = '/postgres'

  const pool = createPool(adminUrl.toString())

  try {
    const existing = await pool.query<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
      [testDbName],
    )

    if (existing.rows[0]?.exists === true) {
      return
    }

    try {
      await pool.query(`CREATE DATABASE ${quotePgIdentifier(testDbName)}`)
    } catch (error) {
      if (!isDuplicateDatabaseError(error)) {
        throw error
      }
    }
  } finally {
    await pool.end()
  }
}

function isDuplicateDatabaseError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  )
}

export async function ensureIntegrationExtensions(testDatabaseUrl: string): Promise<void> {
  assertIntegrationDatabase(testDatabaseUrl)

  const pool = createPool(testDatabaseUrl)

  try {
    await ensureRequiredExtensions(pool)
  } finally {
    await pool.end()
  }
}

function quotePgIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}
