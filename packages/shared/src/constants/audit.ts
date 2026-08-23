import { AuditAction } from '../enums.js'

/**
 * Known `audit_log.entity_type` values written by the API services. The column
 * is free-form text (services may write new types), so this list is a curated
 * convenience for filter dropdowns — the read API still accepts any string.
 */
export const AUDIT_ENTITY_TYPES = [
  'user',
  'emotive_claim',
  'domace_claim',
  'claim_report',
  'attachment',
  'customer',
  'engine_type',
  'engine_manufacturer',
  'claim_category',
  'claim_category_field',
  'claim_category_field_option',
  'chat_conversation',
  'external_party',
  'excel_workbook',
  'app_settings',
] as const

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number]

/** All audit actions as a tuple (mirrors the `audit_log_action_check` DB constraint). */
export const AUDIT_ACTIONS = [
  AuditAction.Create,
  AuditAction.Update,
  AuditAction.Delete,
  AuditAction.Restore,
  AuditAction.Login,
  AuditAction.Logout,
  AuditAction.PermissionChange,
  AuditAction.Export,
  AuditAction.Import,
] as const
