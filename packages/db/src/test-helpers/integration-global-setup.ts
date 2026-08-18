import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb, createPool } from '../client.js'
import * as schema from '../schema/index.js'
import { runDemoSeeds } from '../seed/run-demo-seeds.js'
import { runSystemSeeds } from '../seed/run-system-seeds.js'
import {
  assertIntegrationDatabase,
  ensureIntegrationDatabaseExists,
  ensureIntegrationExtensions,
  getIntegrationDatabaseUrl,
} from './integration-db.js'
import { loadRepoEnv, repoRootFromDbPackage } from './integration-vitest-env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Serializes migrate+seed when turbo runs multiple integration suites in parallel. */
const INTEGRATION_SETUP_LOCK = 824_731_001

export default async function integrationGlobalSetup(): Promise<void> {
  loadRepoEnv(repoRootFromDbPackage(__dirname))

  const url = getIntegrationDatabaseUrl()
  assertIntegrationDatabase(url)
  process.env['DATABASE_URL'] = url
  process.env['TEST_DATABASE_URL'] = url

  await withIntegrationSetupLock(async () => {
    await ensureIntegrationDatabaseExists(url)
    await ensureIntegrationExtensions(url)

    const pool = createPool(url)
    const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

    try {
      await migrate(db, {
        migrationsFolder: resolve(__dirname, '../../migrations'),
      })
      // Disposable database, rebuilt from zero — a leftover retired permission must never block a run.
      await runSystemSeeds(db, { prune: true })
      await runDemoSeeds(db)
    } finally {
      await pool.end()
    }
  })
}

async function withIntegrationSetupLock<T>(fn: () => Promise<T>): Promise<T> {
  const adminUrl = new URL(getIntegrationDatabaseUrl())
  adminUrl.pathname = '/postgres'

  const pool = createPool(adminUrl.toString())
  const client = await pool.connect()

  try {
    await client.query('SELECT pg_advisory_lock($1)', [INTEGRATION_SETUP_LOCK])
    return await fn()
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [INTEGRATION_SETUP_LOCK])
    client.release()
    await pool.end()
  }
}
