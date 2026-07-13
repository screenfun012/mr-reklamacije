/**
 * Permission catalog. Single source of truth for all authorization codes.
 * Must match docs/03-permissions.md exactly. Adding a new permission requires:
 *   1. Add to PERMISSIONS array below
 *   2. Add to relevant system role(s) if applicable
 *   3. Add database migration to seed into permissions table
 *   4. Update docs/03-permissions.md
 *
 * Note: `observations.view_client_visible` and `attachments.view_client_visible`
 * appear in the system `client` role list in the doc; they extend the module tables
 * so client portal access is representable as typed Permission strings.
 */

export const PERMISSIONS = [
  // emotive_claims
  'emotive_claims.view',
  'emotive_claims.view_own_customer',
  'emotive_claims.create',
  'emotive_claims.update',
  'emotive_claims.delete',
  'emotive_claims.restore',
  'emotive_claims.change_outcome',
  'emotive_claims.reopen',
  'emotive_claims.unarchive',

  // domace_claims
  'domace_claims.view',
  'domace_claims.view_own_customer',
  'domace_claims.create',
  'domace_claims.update',
  'domace_claims.delete',
  'domace_claims.restore',
  'domace_claims.change_outcome',
  'domace_claims.reopen',
  'domace_claims.unarchive',

  // observations
  'observations.view_internal',
  'observations.create_internal',
  'observations.create_client_visible',
  'observations.edit_own',
  'observations.delete_own',
  'observations.delete_any',
  'observations.view_client_visible',

  // attachments
  'attachments.view_internal',
  'attachments.upload',
  'attachments.delete_own',
  'attachments.delete_any',
  'attachments.change_visibility',
  'attachments.view_client_visible',

  // client_submissions (portal ticket intake)
  'client_submissions.create',
  'client_submissions.manage',

  // claim_reports
  'claim_reports.view',
  'claim_reports.update',
  'claim_reports.export',

  // customers
  'customers.view',
  'customers.create',
  'customers.update',
  'customers.delete',
  'customers.link_users',

  // employees
  'employees.view',
  'employees.view_analytics',
  'employees.create',
  'employees.update',
  'employees.deactivate',
  'employees.delete',

  // employee_output
  'employee_output.view',
  'employee_output.update',

  // statistics
  'statistics.view_emotive',
  'statistics.view_domace',
  'statistics.view_overall',
  'statistics.view_financial',

  // export
  'export.workbook_full',
  'export.workbook_partial',
  'export.own_claims',

  // import
  'import.legacy_excel',

  // users
  'users.view',
  'users.create',
  'users.update',
  'users.deactivate',
  'users.delete',
  'users.reset_password',
  'users.manage_2fa',
  'users.approve_registration',
  'users.reject_registration',

  // roles
  'roles.view',
  'roles.create',
  'roles.update',
  'roles.delete',
  'roles.assign',

  // settings
  'settings.departments.manage',
  'settings.engine_types.manage',
  'settings.engine_types.create',
  'settings.engine_manufacturers.manage',
  'settings.engine_manufacturers.create',
  'settings.external_parties.create',
  'settings.external_parties.manage',
  'settings.claim_sources.manage',
  'settings.app_settings.view',
  'settings.app_settings.update',
  'settings.app_settings.manage_secrets',

  // audit
  'audit.view',
  'audit.export',

  // translation
  'translation.request',
  'translation.manage_cache',
] as const

export type Permission = (typeof PERMISSIONS)[number]

/**
 * System role permission sets. These are hardcoded in code, not DB,
 * because they define minimum required permissions for each system role
 * (admin can never lose admin powers due to DB drift; operator can't
 * accidentally lose basic CRUD through UI misclick).
 *
 * Custom roles are defined in the DB (roles + role_permissions tables).
 */

export const ADMIN_PERMISSIONS: readonly Permission[] = PERMISSIONS

export const OPERATOR_PERMISSIONS: readonly Permission[] = [
  'emotive_claims.view',
  'emotive_claims.create',
  'emotive_claims.update',
  'emotive_claims.delete',
  'emotive_claims.change_outcome',
  'domace_claims.view',
  'domace_claims.create',
  'domace_claims.update',
  'domace_claims.delete',
  'domace_claims.change_outcome',
  'observations.view_internal',
  'observations.create_internal',
  'observations.create_client_visible',
  'observations.edit_own',
  'observations.delete_own',
  'attachments.view_internal',
  'attachments.upload',
  'attachments.delete_own',
  'attachments.change_visibility',
  'client_submissions.manage',
  'claim_reports.view',
  'claim_reports.update',
  'customers.view',
  'customers.create',
  'customers.update',
  'employees.view',
  'employees.view_analytics',
  'employee_output.view',
  'employee_output.update',
  'statistics.view_emotive',
  'statistics.view_domace',
  'statistics.view_financial',
  'export.workbook_full',
  'export.workbook_partial',
  'settings.engine_types.create',
  'settings.external_parties.create',
  'translation.request',
] as const

export const VIEWER_PERMISSIONS: readonly Permission[] = [
  'emotive_claims.view',
  'domace_claims.view',
  'observations.view_internal',
  'attachments.view_internal',
  'claim_reports.view',
  'customers.view',
  'employees.view',
  'employees.view_analytics',
  'employee_output.view',
  'statistics.view_emotive',
  'statistics.view_domace',
  'statistics.view_financial',
  'export.workbook_full',
  'export.workbook_partial',
] as const

/** Permissions that allow viewing the EMOTIVE claims list (API + internal-web route). */
export const EMOTIVE_CLAIMS_LIST_VIEW_PERMISSIONS = [
  'emotive_claims.view',
  'emotive_claims.view_own_customer',
] as const satisfies readonly Permission[]

/** Permissions that allow viewing DOMACE claims (API + internal-web detail route). */
export const DOMACE_CLAIMS_LIST_VIEW_PERMISSIONS = [
  'domace_claims.view',
  'domace_claims.view_own_customer',
] as const satisfies readonly Permission[]

/** Permissions that allow viewing the unified claims list (API + internal-web /reklamacije). */
export const CLAIMS_LIST_VIEW_PERMISSIONS = [
  ...EMOTIVE_CLAIMS_LIST_VIEW_PERMISSIONS,
  ...DOMACE_CLAIMS_LIST_VIEW_PERMISSIONS,
] as const satisfies readonly Permission[]

/** Permissions that allow viewing statistics analytics (API + internal-web /statistika). */
export const STATISTICS_VIEW_PERMISSIONS = [
  'statistics.view_emotive',
  'statistics.view_domace',
  'statistics.view_overall',
] as const satisfies readonly Permission[]

export const CLIENT_PERMISSIONS: readonly Permission[] = [
  'emotive_claims.view_own_customer',
  'domace_claims.view_own_customer',
  'observations.view_client_visible',
  'attachments.view_client_visible',
  'client_submissions.create',
  'export.own_claims',
  'translation.request',
] as const
