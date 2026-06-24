import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import { createDb, createPool, getDatabaseUrl } from '../client.js'
import * as schema from '../schema/index.js'
import { seedEngineManufacturers } from './engine-manufacturers.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '../../../..')
config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })

async function main(): Promise<void> {
  const pool = createPool(getDatabaseUrl())
  const db = createDb(pool) as unknown as NodePgDatabase<typeof schema>

  try {
    await seedEngineManufacturers(db)
  } catch (error) {
    console.error('[seed:engine-manufacturers] Failed:', error)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

void main()
