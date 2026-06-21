import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '../schema/index.js'
import { seedClaimSources } from './claim-sources.js'
import { seedCustomers } from './customers.js'
import { seedDepartments } from './departments.js'
import { seedDomaceClaims } from './domace-claims.js'
import { seedEmotiveClaims } from './emotive-claims.js'
import { seedEmployees } from './employees.js'
import { seedEngineTypes } from './engine-types.js'
import { seedPermissions } from './permissions.js'
import { seedRoles } from './roles.js'

/**
 * System seeds in topological FK order. Idempotent — safe for dev CLI and
 * integration test globalSetup.
 */
export async function runSystemSeeds(db: NodePgDatabase<typeof schema>): Promise<void> {
  await seedPermissions(db)
  await seedRoles(db)
  await seedDepartments(db)
  await seedEmployees(db)
  await seedCustomers(db)
  await seedClaimSources(db)
  await seedEngineTypes(db)
  await seedEmotiveClaims(db)
  await seedDomaceClaims(db)
}
