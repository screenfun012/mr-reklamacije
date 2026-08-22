import type { Permission } from '@mr/shared'

/**
 * The STANDARD privilege sets — small, independent, and added together on a person
 * (`docs/superpowers/specs/2026-08-17-roles-admin-panel-design.md` §5).
 *
 * They are rows in `roles` like any other, marked `is_system = true` so the panel offers copying
 * instead of editing, and the seed keeps their action list equal to what stands here. A set Nikola
 * composed himself (`is_system = false`) is his — the seed never touches it.
 *
 * ⚠ **This file GRANTS, it never CHECKS.** It is listed in `permission-enforcement.test.ts`'s
 * `DECLARATION_FILES` for that reason: a file naming half the catalog would otherwise declare half
 * the catalog enforced, and the guard that finds dead switches would go quiet about them.
 *
 * The shape of the list is the point, and it was Nikola's correction (17.08.): the first draft
 * proposed cloning `operator` and removing one action from the copy, which is how a system ends up
 * with fifty roles nobody can tell apart. Three small sets give eight combinations while three
 * things are maintained.
 */
export interface StandardRoleSeed {
  readonly code: string
  readonly nameSr: string
  readonly nameEn: string
  readonly permissions: readonly Permission[]
}

export const STANDARD_ROLES = [
  // ── Prijem vozila ────────────────────────────────────────────────────────────────────────────
  {
    code: 'intake_field',
    nameSr: 'Prijem — rad na terenu',
    nameEn: 'Intake — shop floor',
    permissions: [
      'intake_orders.view_own',
      'intake_orders.create',
      'intake_orders.update',
      'intake_orders.advance',
    ],
  },
  {
    // Somebody else's orders. His own unfinished draft every author may delete anyway.
    code: 'intake_office',
    nameSr: 'Prijem — kancelarija',
    nameEn: 'Intake — office',
    permissions: ['intake_orders.view', 'intake_orders.change_status', 'intake_orders.delete'],
  },
  {
    // Its own set because it reaches OUT of the shop, into a customer's inbox.
    code: 'intake_send_document',
    nameSr: 'Prijem — slanje dokumenta',
    nameEn: 'Intake — send the document',
    permissions: ['intake_orders.send_document'],
  },
  {
    code: 'intake_view',
    nameSr: 'Prijem — samo pregled',
    nameEn: 'Intake — view only',
    permissions: ['intake_orders.view'],
  },

  // ── Reklamacije ──────────────────────────────────────────────────────────────────────────────
  {
    code: 'claims_view',
    nameSr: 'Reklamacije — pregled',
    nameEn: 'Claims — view',
    permissions: [
      'emotive_claims.view',
      'domace_claims.view',
      'attachments.view_internal',
      'claim_reports.view',
      'customers.view',
      'employees.view',
    ],
  },
  {
    /**
     * Carries `customers.view` and `employees.view` of its own, and that repetition is deliberate
     * (§3.2 rule 1): `GET /api/customers` and `/api/employees` demand their own actions, so this
     * set without them hands somebody a claim form whose dropdowns are all empty.
     *
     * The two `settings.*.create` actions are here for the same practical reason and no other —
     * they let a claim be entered when the engine type is missing from the list. They are NOT
     * `manage`: adding what you need mid-form is not administering the catalog.
     */
    code: 'claims_process',
    nameSr: 'Reklamacije — obrada',
    nameEn: 'Claims — processing',
    permissions: [
      'emotive_claims.create',
      'emotive_claims.update',
      'domace_claims.create',
      'domace_claims.update',
      'attachments.upload',
      'attachments.delete_own',
      'claim_reports.update',
      'claim_reports.export',
      'customers.view',
      'employees.view',
      'settings.engine_types.create',
      'settings.external_parties.create',
    ],
  },
  {
    code: 'claims_outcome',
    nameSr: 'Reklamacije — odluka o ishodu',
    nameEn: 'Claims — outcome decision',
    permissions: ['emotive_claims.change_outcome', 'domace_claims.change_outcome'],
  },
  {
    // Both actions decide what leaves the firm and appears on the partner's portal.
    code: 'claims_client_visibility',
    nameSr: 'Reklamacije — šta klijent vidi',
    nameEn: 'Claims — what the client sees',
    permissions: ['emotive_claims.publish', 'attachments.change_visibility'],
  },
  {
    code: 'claims_delete',
    nameSr: 'Reklamacije — brisanje i arhiva',
    nameEn: 'Claims — deletion and archive',
    permissions: [
      'emotive_claims.delete',
      'emotive_claims.restore',
      'domace_claims.delete',
      'domace_claims.restore',
      'attachments.delete_any',
    ],
  },

  // ── Kupci i radnici ──────────────────────────────────────────────────────────────────────────
  {
    code: 'customers_manage',
    nameSr: 'Kupci — vođenje',
    nameEn: 'Customers — management',
    permissions: ['customers.view', 'customers.create', 'customers.update', 'customers.delete'],
  },
  {
    code: 'employees_manage',
    nameSr: 'Radnici — vođenje',
    nameEn: 'Employees — management',
    permissions: [
      'employees.view',
      'employees.create',
      'employees.update',
      'employees.deactivate',
      'employees.delete',
    ],
  },
  {
    // Measuring a named person is its own question, separate from seeing that he exists.
    code: 'employees_analytics',
    nameSr: 'Radnici — učinak',
    nameEn: 'Employees — performance',
    permissions: ['employees.view', 'employees.view_analytics'],
  },

  // ── Brojke ───────────────────────────────────────────────────────────────────────────────────
  {
    code: 'statistics_view',
    nameSr: 'Statistika',
    nameEn: 'Statistics',
    permissions: ['statistics.view_emotive', 'statistics.view_domace'],
  },
  {
    code: 'statistics_financial',
    nameSr: 'Statistika — novac',
    nameEn: 'Statistics — money',
    permissions: ['statistics.view_financial'],
  },
  {
    code: 'export_excel',
    nameSr: 'Izvoz u Excel',
    nameEn: 'Excel export',
    permissions: ['export.workbook_full', 'export.workbook_partial'],
  },

  // ── Portal i sanduče ─────────────────────────────────────────────────────────────────────────
  {
    code: 'client_submissions',
    nameSr: 'Pristiglo — prijave klijenata',
    nameEn: 'Inbox — client submissions',
    permissions: ['client_submissions.manage'],
  },
  {
    code: 'notifications',
    nameSr: 'Obaveštenja',
    nameEn: 'Notifications',
    permissions: ['notifications.view_own'],
  },

  // ── Kontrolna tabla ──────────────────────────────────────────────────────────────────────────
  {
    code: 'users_view',
    nameSr: 'Korisnici — pregled',
    nameEn: 'Users — view',
    permissions: ['users.view'],
  },
  {
    // `create` alongside `manage` wherever the catalog has both: an administrator of a list owns
    // the whole list, and splitting them here would only describe a person who does not exist.
    code: 'catalogs_claims',
    nameSr: 'Šifarnici — reklamacije',
    nameEn: 'Catalogs — claims',
    permissions: [
      'settings.departments.manage',
      'settings.engine_types.manage',
      'settings.engine_types.create',
      'settings.engine_manufacturers.manage',
      'settings.engine_manufacturers.create',
      'settings.external_parties.manage',
      'settings.external_parties.create',
      'settings.claim_sources.manage',
      'settings.claim_categories.manage',
    ],
  },
  {
    code: 'catalogs_intake',
    nameSr: 'Šifarnici — prijem',
    nameEn: 'Catalogs — intake',
    permissions: [
      'settings.intake_checklist.manage',
      'settings.intake_damage_types.manage',
      'settings.intake_arrival_modes.manage',
    ],
  },
  {
    code: 'audit_view',
    nameSr: 'Istorija',
    nameEn: 'Audit trail',
    permissions: ['audit.view'],
  },
] as const satisfies readonly StandardRoleSeed[]

/**
 * Deliberately NOT here — admin-only, Nikola's decision of 17.08. after the demo. Handing out
 * rights stays with the super-admin account; everyone else is a worker.
 *
 * `users.reset_password` (sets somebody else's password outright), `users.create`/`delete`,
 * `roles.*` (this panel), `settings.app_settings.manage_secrets`, `roles.assign`,
 * `users.approve_registration`/`reject_registration` + `customers.link_users` (approving a person
 * gives him a role, so it gives him rights), `users.deactivate`, and
 * `settings.app_settings.view`/`update`.
 *
 * `intake_orders.archive` is here for the same reason from 2026-08-22: a signed order is the
 * firm's half of a paper the owner is holding, so taking it out of the list is the office's call.
 * The office can still be given it from the admin panel — it is simply in no ready-made package.
 *
 * The seven portal actions are not sets either: `view_own_customer` is not "sees less", it is
 * "sees the rows of his own firm" — and a person from the firm has no firm.
 */
