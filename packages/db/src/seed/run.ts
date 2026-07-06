import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { createDb, createPool, getDatabaseUrl } from '../client.js'
import * as schema from '../schema/index.js'
import { runDemoSeeds } from './run-demo-seeds.js'
import { runSystemSeeds } from './run-system-seeds.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../../..')
config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })

async function main(): Promise<void> {
  const pool = createPool(getDatabaseUrl())
  const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

  const withDemo = process.argv.includes('--demo')

  try {
    console.log('[seed] Starting system seeds...')
    await runSystemSeeds(db)
    if (withDemo) {
      console.log('[seed] Starting demo seeds (sample claims/employees/customers)...')
      await runDemoSeeds(db)
    }
    console.log('[seed] All seeds completed successfully')
  } catch (error) {
    console.error('[seed] Failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
