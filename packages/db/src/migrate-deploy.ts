import { config } from 'dotenv'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDb, createPool, getDatabaseUrl } from './client.js'
import { ensureRequiredExtensions } from './extensions.js'
import * as schema from './schema/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../..')
config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })

/**
 * Deploy-time migrator (Railway pre-deploy command): installs the required
 * Postgres extensions first, then applies all pending migrations. Idempotent —
 * safe to run on every deploy and on a completely empty database.
 */
async function main(): Promise<void> {
  const pool = createPool(getDatabaseUrl())
  const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

  try {
    console.log('[migrate:deploy] Ensuring required Postgres extensions...')
    await ensureRequiredExtensions(pool)

    console.log('[migrate:deploy] Applying migrations...')
    await migrate(db, { migrationsFolder: resolve(__dirname, '../migrations') })

    console.log('[migrate:deploy] Database is up to date')
  } catch (error) {
    console.error('[migrate:deploy] Failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
