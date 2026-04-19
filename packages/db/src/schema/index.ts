/**
 * Drizzle schema barrel. Re-exports all tables from domain modules.
 * Updated as modules are added:
 *   - access-control.ts (Phase B.2): users, roles, permissions, junctions
 *   - customers.ts (Phase B.3): customers, customer_users
 *   - employees.ts (Phase B.3): departments, employees
 *   - audit.ts (Phase B.3): audit_log
 *   - catalogs.ts (Phase C.1): engine_types, external_parties, claim_sources
 *   - client-registrations.ts (Phase C.1): client_registration_requests
 *   - claims.ts (Phase C.2)
 *   - attachments.ts (Phase C.3): attachments, claim_observations
 *   - translation-cache.ts (Phase C.3): translation_cache
 *   - settings.ts (Phase C.3): app_settings, employee_monthly_output
 *   - auth-tables.ts (6.2): Better-Auth sessions, accounts, verification_tokens, two_factor_secrets
 */
export * from './pg-types.js'
export * from './access-control.js'
export * from './auth-tables.js'
export * from './customers.js'
export * from './employees.js'
export * from './audit.js'
export * from './catalogs.js'
export * from './client-registrations.js'
export * from './claims.js'
export * from './attachments.js'
export * from './translation-cache.js'
export * from './settings.js'
