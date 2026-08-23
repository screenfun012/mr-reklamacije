/**
 * Drizzle schema barrel. Re-exports all tables from domain modules.
 * Updated as modules are added:
 *   - access-control.ts (Phase B.2): users, roles, permissions, junctions
 *   - customers.ts (Phase B.3): customers, customer_users
 *   - employees.ts (Phase B.3): departments, employees
 *   - audit.ts (Phase B.3): audit_log
 *   - catalogs.ts (Phase C.1): engine_manufacturers, engine_types, external_parties, claim_sources
 *   - claims.ts (Phase C.2)
 *   - mr-registry.ts: mr_registry (global MR unique registry)
 *   - client-submissions.ts (docs/18): client_submissions (portal inbox → claim)
 *   - notifications.ts: notifications (in-app inbox, one row per recipient)
 *   - intake-orders.ts (docs/25): intake_orders (vehicle service intake)
 *   - attachments.ts (Phase C.3): attachments, claim_observations
 *   - claim-reports.ts (Phase 3.0): claim_reports
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
export * from './client-activation-tokens.js'
export * from './claims.js'
export * from './emotive-claim-client-views.js'
export * from './mr-registry.js'
export * from './client-submissions.js'
export * from './notifications.js'
export * from './intake-orders.js'
export * from './attachments.js'
export * from './claim-reports.js'
export * from './translation-cache.js'
export * from './settings.js'
export * from './chat.js'
