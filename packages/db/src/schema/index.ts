/**
 * Drizzle schema barrel. Re-exports all tables from domain modules.
 * Updated as modules are added:
 *   - access-control.ts (Phase B.2): users, roles, permissions, junctions
 *   - customers.ts (Phase B.3): customers, customer_users
 *   - employees.ts (Phase B.3): departments, employees
 *   - audit.ts (Phase B.3): audit_log
 *   - claims.ts (Phase C)
 *   - observations.ts (Phase C)
 *   - attachments.ts (Phase C)
 *   - external-parties.ts (Phase C)
 */
export * from './pg-types.js'
export * from './access-control.js'
export * from './customers.js'
export * from './employees.js'
export * from './audit.js'
