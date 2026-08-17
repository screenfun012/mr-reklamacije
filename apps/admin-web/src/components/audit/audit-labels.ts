import { AuditAction } from '@mr/shared'
import { m } from '@mr/i18n'

/** Localized label for an audit action; unknown values fall back to the raw value. */
const ACTION_LABELS: Record<string, () => string> = {
  [AuditAction.Create]: () => m.audit_action_create(),
  [AuditAction.Update]: () => m.audit_action_update(),
  [AuditAction.Delete]: () => m.audit_action_delete(),
  [AuditAction.Restore]: () => m.audit_action_restore(),
  [AuditAction.Login]: () => m.audit_action_login(),
  [AuditAction.Logout]: () => m.audit_action_logout(),
  [AuditAction.PermissionChange]: () => m.audit_action_permission_change(),
  [AuditAction.Export]: () => m.audit_action_export(),
  [AuditAction.Import]: () => m.audit_action_import(),
}

export function auditActionLabel(action: string): string {
  return (ACTION_LABELS[action] ?? (() => action))()
}

/** Localized label for a known entity type; unknown values fall back to the raw value. */
const ENTITY_LABELS: Record<string, () => string> = {
  user: () => m.audit_entity_user(),
  emotive_claim: () => m.audit_entity_emotive_claim(),
  domace_claim: () => m.audit_entity_domace_claim(),
  claim_report: () => m.audit_entity_claim_report(),
  attachment: () => m.audit_entity_attachment(),
  customer: () => m.audit_entity_customer(),
  engine_type: () => m.audit_entity_engine_type(),
  engine_manufacturer: () => m.audit_entity_engine_manufacturer(),
  external_party: () => m.audit_entity_external_party(),
  excel_workbook: () => m.audit_entity_excel_workbook(),
  app_settings: () => m.audit_entity_app_settings(),
}

export function auditEntityTypeLabel(entityType: string): string {
  return (ENTITY_LABELS[entityType] ?? (() => entityType))()
}
