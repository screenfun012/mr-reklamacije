export { createDb, createPool, getDatabaseUrl } from './client.js'
export { backfillMrRegistry } from './maintenance/backfill-mr-registry.js'
export {
  linkEmployeesToDepartments,
  type DepartmentSeed,
  type EmployeeRoster,
  type LinkEmployeesResult,
  type RosterEmployee,
} from './maintenance/link-employees-to-departments.js'
export {
  assertIntegrationDatabase,
  DEFAULT_TEST_DATABASE_URL,
  DEV_DATABASE_NAME,
  getIntegrationDatabaseUrl,
} from './test-helpers/integration-db.js'
export * as schema from './schema/index.js'
