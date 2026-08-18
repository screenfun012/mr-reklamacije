import { m } from '@mr/i18n'

/**
 * The `module` column of a permission is what groups the matrix, and it holds a code
 * (`intake_orders`). Same shape as `audit-labels.ts`: a map with a fallback to the raw value, so a
 * module added in code shows up as its code instead of vanishing from the screen.
 */
const MODULE_LABELS: Record<string, () => string> = {
  emotive_claims: () => m.roles_module_emotive_claims(),
  domace_claims: () => m.roles_module_domace_claims(),
  attachments: () => m.roles_module_attachments(),
  claim_reports: () => m.roles_module_claim_reports(),
  client_submissions: () => m.roles_module_client_submissions(),
  notifications: () => m.roles_module_notifications(),
  intake_orders: () => m.roles_module_intake_orders(),
  customers: () => m.roles_module_customers(),
  employees: () => m.roles_module_employees(),
  employee_output: () => m.roles_module_employee_output(),
  statistics: () => m.roles_module_statistics(),
  export: () => m.roles_module_export(),
  users: () => m.roles_module_users(),
  roles: () => m.roles_module_roles(),
  settings: () => m.roles_module_settings(),
  audit: () => m.roles_module_audit(),
}

export function roleModuleLabel(module: string): string {
  return (MODULE_LABELS[module] ?? (() => module))()
}
