import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '../schema/index.js'
import { seedClaimSources } from './claim-sources.js'
import { seedDepartments } from './departments.js'
import { seedEngineManufacturers } from './engine-manufacturers.js'
import { seedIntakeCatalogs } from './intake-catalogs.js'
import { seedPermissions, type SeedPermissionsOptions } from './permissions.js'
import { seedRoles } from './roles.js'

export type SystemSeedOptions = SeedPermissionsOptions

/**
 * System seeds in topological FK order: reference data every environment
 * needs (permissions, roles, departments, claim sources, engine
 * manufacturers). Idempotent — safe for production, dev CLI and integration
 * test globalSetup. Demo/test data lives in runDemoSeeds.
 *
 * ⚠ ONE TRANSACTION, and that is not tidiness. Two of these steps DELETE — `seedPermissions`
 * prunes a retired permission with every grant of it, and `seedRoles` syncs a system set's actions
 * to the code — and two of them THROW on purpose: the prune guard, and the check that stops the
 * seed from taking over a set built in the panel. Run step by step, the first would commit its
 * deletions and the second would then abort the run, leaving production with permissions gone,
 * roles half-written and the catalogs never reached. Nothing names that state and nothing repairs
 * it. Wrapped, a refusal costs a re-run and nothing else.
 */
export async function runSystemSeeds(
  db: NodePgDatabase<typeof schema>,
  options: SystemSeedOptions = {},
): Promise<void> {
  await db.transaction(async (tx) => {
    await seedPermissions(tx, options)
    await seedRoles(tx)
    await seedDepartments(tx)
    await seedClaimSources(tx)
    await seedEngineManufacturers(tx)
    await seedIntakeCatalogs(tx)
  })
}
