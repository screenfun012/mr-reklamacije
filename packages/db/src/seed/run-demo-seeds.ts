import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '../schema/index.js'
import { seedCustomers } from './customers.js'
import { seedDomaceClaims } from './domace-claims.js'
import { seedEmotiveClaims } from './emotive-claims.js'
import { seedEmployees } from './employees.js'
import { seedEngineTypes } from './engine-types.js'

/**
 * Demo/test data seeds (sample employees, customers, engine types and claims)
 * in topological FK order. Idempotent. NEVER run against production — real
 * data comes from the legacy import (apps/api/scripts/import-legacy.ts).
 * Requires runSystemSeeds to have run first (departments, claim sources,
 * engine manufacturers).
 */
export async function runDemoSeeds(db: NodePgDatabase<typeof schema>): Promise<void> {
  await seedEmployees(db)
  await seedCustomers(db)
  await seedEngineTypes(db)
  await seedEmotiveClaims(db)
  await seedDomaceClaims(db)
}
