import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { createDb, createPool, getDatabaseUrl } from '../client.js'
import * as schema from '../schema/index.js'
import { seedClaimSources } from './claim-sources.js'
import { seedCustomers } from './customers.js'
import { seedDepartments } from './departments.js'
import { seedEmotiveClaims } from './emotive-claims.js'
import { seedEmployees } from './employees.js'
import { seedEngineTypes } from './engine-types.js'
import { seedPermissions } from './permissions.js'
import { seedRoles } from './roles.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../../..')
config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })

/**
 * Orchestrator for all system seeds. Runs in topological FK order:
 * 1. permissions (no FK)
 * 2. roles + role_permissions (FK to permissions)
 * 3. departments (no FK)
 * 4. employees (FK to departments)
 * 5. customers (no FK, but claim_sources depends on them)
 * 6. claim_sources (FK to customers)
 *
 * All seeds are idempotent — safe to run multiple times.
 */
async function main(): Promise<void> {
  const pool = createPool(getDatabaseUrl())
  const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

  try {
    console.log('[seed] Starting system seeds...')
    await seedPermissions(db)
    await seedRoles(db)
    await seedDepartments(db)
    await seedEmployees(db)
    await seedCustomers(db)
    await seedClaimSources(db)
    await seedEngineTypes(db)
    await seedEmotiveClaims(db)
    console.log('[seed] All seeds completed successfully')
  } catch (error) {
    console.error('[seed] Failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
