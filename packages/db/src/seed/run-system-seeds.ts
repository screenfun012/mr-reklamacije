import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '../schema/index.js'
import { seedClaimSources } from './claim-sources.js'
import { seedDepartments } from './departments.js'
import { seedEngineManufacturers } from './engine-manufacturers.js'
import { seedIntakeCatalogs } from './intake-catalogs.js'
import { seedPermissions } from './permissions.js'
import { seedRoles } from './roles.js'

/**
 * System seeds in topological FK order: reference data every environment
 * needs (permissions, roles, departments, claim sources, engine
 * manufacturers). Idempotent — safe for production, dev CLI and integration
 * test globalSetup. Demo/test data lives in runDemoSeeds.
 */
export async function runSystemSeeds(db: NodePgDatabase<typeof schema>): Promise<void> {
  await seedPermissions(db)
  await seedRoles(db)
  await seedDepartments(db)
  await seedClaimSources(db)
  await seedEngineManufacturers(db)
  await seedIntakeCatalogs(db)
}
