/**
 * Permission catalog. Single source of truth for all authorization codes.
 * Adding a new permission requires:
 *   1. Add to PERMISSIONS array below
 *   2. Add to relevant system role(s) if applicable
 *   3. Update docs/03-permissions.md
 *
 * ⚠ **A permission may not exist without code that checks it.** `permission-enforcement.test.ts`
 * reads every source file in the repo and fails on any entry below that appears nowhere else — so
 * the catalog cannot drift ahead of the app again. It did: on 2026-08-17, **32 of 97 entries were
 * checked by nothing**, written years ahead of features that were never built. A switch that
 * controls nothing is worse than a missing one, because unticking it looks like forbidding
 * something.
 *
 * 13 were retired that day, `observations.*` among them — that module was replaced by Nalazi
 * (findings, migration 0031) and its table has stood empty since. `db:seed` prunes the leftovers
 * from the database (`seedPermissions`), so removing an entry here is the whole job.
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
  'emotive_claims.publish',

  // domace_claims
  'domace_claims.view',
  'domace_claims.view_own_customer',
  'domace_claims.create',
  'domace_claims.update',
  'domace_claims.delete',
  'domace_claims.restore',
  'domace_claims.change_outcome',

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

  // notifications (in-app inbox)
  'notifications.view_own',

  // intake_orders (vehicle service intake, docs/25)
  'intake_orders.view',
  'intake_orders.view_own',
  'intake_orders.create',
  'intake_orders.update',
  'intake_orders.advance',
  'intake_orders.change_status',
  'intake_orders.delete',
  /**
   * Sending the sealed work order to the owner again — the same file, never a new one. Its own
   * permission because it reaches OUT of the shop: it puts a document in a customer's inbox, which
   * is not something every hand that may correct a specification should be able to do.
   */
  'intake_orders.send_document',
  /**
   * Taking a SIGNED order out of the working list — and putting it back. Not a delete: the row,
   * its document and its history stay, and its number stays taken. Its own permission, and in no
   * standard package, because a signed order is the firm's half of the owner's paper and hiding
   * it is the office's decision, not the shop floor's (Nikola, 2026-08-22). An unfinished draft is
   * still DISCARDED, never archived — see `intake_orders.delete`.
   */
  'intake_orders.archive',
  /**
   * Attaching the quote to a finished intake, replacing it, or taking it off. Not `update`: the
   * office package does not hold that one, and `update` is frozen after the signature — while the
   * quote is attached precisely AFTER, when the services and the materials are known (Nikola,
   * 2026-08-22). Reading a quote takes no permission of its own: whoever may open the order may
   * read its papers, which is the rule its two sealed neighbours already follow.
   */
  'intake_orders.attach_quote',
  /**
   * Removing a SIGNED order for good — the row, its photographs, its quote and both sealed PDFs,
   * with its number going back into circulation. Not `intake_orders.delete`, which discards an
   * unfinished draft: this one destroys the firm's half of a paper the owner is holding, and it
   * cannot be undone. Its own permission, and in no standard package — a mistake made during
   * intake is the office's to erase, and by default only an admin can (Nikola, 2026-08-22).
   * Archiving stays the normal way to take an order off the list.
   */
  'intake_orders.delete_signed',

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

  // users
  'users.view',
  'users.create',
  'users.update',
  'users.deactivate',
  'users.delete',
  'users.reset_password',
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
  'settings.claim_categories.manage',
  // The vehicle-intake lists the shop owns (docs/25 §3.0.2). Deliberately `manage`-only and
  // deliberately NOT in OPERATOR_PERMISSIONS: Nikola asked for the admin app to be the place these
  // are changed, separated from the operator, "jer ako to ne uradimo onda admin deo gubi smisla".
  'settings.intake_checklist.manage',
  'settings.intake_damage_types.manage',
  'settings.intake_arrival_modes.manage',
  'settings.app_settings.view',
  'settings.app_settings.update',
  'settings.app_settings.manage_secrets',

  // audit
  'audit.view',
  'audit.export',
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
  'emotive_claims.publish',
  'domace_claims.view',
  'domace_claims.create',
  'domace_claims.update',
  'domace_claims.delete',
  'domace_claims.change_outcome',
  'attachments.view_internal',
  'attachments.upload',
  'attachments.delete_own',
  'attachments.change_visibility',
  'client_submissions.manage',
  'notifications.view_own',
  // The office oversees every intake. It cannot CORRECT one after signing — since 2026-08-11
  // nobody can, admin included (docs/25 §3.0.1) — but it owns the status, the specification and
  // the added contact number. There is no separate "kancelarija" role.
  'intake_orders.view',
  'intake_orders.view_own',
  'intake_orders.create',
  'intake_orders.update',
  'intake_orders.advance',
  'intake_orders.change_status',
  'intake_orders.delete',
  'intake_orders.send_document',
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
] as const

export const VIEWER_PERMISSIONS: readonly Permission[] = [
  'emotive_claims.view',
  'domace_claims.view',
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

/**
 * Serviser (docs/25): the shop floor. Sees only his own intake orders, creates and
 * fills them in, and steps the status forward one notch. Deliberately holds NOTHING
 * else — no claims, no statistics, no `attachments.*` (intake photos are served by
 * the intake module under its own permission, so this role can never reach a claim's
 * files), and no `notifications.view_own` until intake notifications are designed.
 */
export const SERVISER_PERMISSIONS: readonly Permission[] = [
  'intake_orders.view_own',
  'intake_orders.create',
  'intake_orders.update',
  'intake_orders.advance',
] as const

/**
 * Permissions that allow viewing intake orders (API + internal-web "Servis").
 * `view` is the whole shop, `view_own` only the caller's own rows.
 */
export const INTAKE_ORDERS_VIEW_PERMISSIONS = [
  'intake_orders.view',
  'intake_orders.view_own',
] as const satisfies readonly Permission[]

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

/**
 * Who may open the INTERNAL claim screens.
 *
 * Deliberately WITHOUT the `view_own_customer` variants: those exist for the client portal, and
 * the API must keep accepting them because the portal calls the same endpoints. The internal app
 * must not. A portal client who signs in at internal.mrclaims.live used to pass the route guard
 * on the strength of `emotive_claims.view_own_customer`, land on the internal claim screen, and
 * find every action hidden and every request answered 403/404 — a screen that reads as broken
 * software rather than as a door that was never theirs (found 2026-08-21).
 *
 * Not a role allowlist on purpose: roles are DATA — the office can build new ones in the admin
 * panel — so the rule has to be written in permissions, which are code.
 */
export const INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS = [
  'emotive_claims.view',
] as const satisfies readonly Permission[]

export const INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS = [
  'domace_claims.view',
] as const satisfies readonly Permission[]

export const INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS = [
  ...INTERNAL_EMOTIVE_CLAIMS_VIEW_PERMISSIONS,
  ...INTERNAL_DOMACE_CLAIMS_VIEW_PERMISSIONS,
] as const satisfies readonly Permission[]

/** Permissions that allow viewing statistics analytics (API + internal-web /statistika). */
export const STATISTICS_VIEW_PERMISSIONS = [
  'statistics.view_emotive',
  'statistics.view_domace',
  'statistics.view_overall',
] as const satisfies readonly Permission[]

/**
 * "This account belongs in the internal app at all" — the union of every permission that opens
 * one of its screens. Used by the screens that are not about one module (a person's own
 * security settings), where the alternative would be a role allowlist.
 *
 * A role allowlist is wrong here on purpose: roles are DATA (the office builds them in the admin
 * panel), so a freshly-made "Statistika" role would be refused by a list of role codes written
 * in code. Permissions are code; a role is a bag of them.
 */
export const INTERNAL_APP_PERMISSIONS = [
  ...INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS,
  ...INTAKE_ORDERS_VIEW_PERMISSIONS,
  ...STATISTICS_VIEW_PERMISSIONS,
  'client_submissions.manage',
] as const satisfies readonly Permission[]

export const CLIENT_PERMISSIONS: readonly Permission[] = [
  'emotive_claims.view_own_customer',
  'domace_claims.view_own_customer',
  'attachments.view_client_visible',
  'client_submissions.create',
  'export.own_claims',
] as const
