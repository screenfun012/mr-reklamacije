export const UserLanguage = {
  Sr: 'sr',
  En: 'en',
} as const

export type UserLanguage = (typeof UserLanguage)[keyof typeof UserLanguage]

export const CustomerKind = {
  EmotivePartner: 'emotive_partner',
  DomesticCompany: 'domestic_company',
  DomesticIndividual: 'domestic_individual',
} as const

export type CustomerKind = (typeof CustomerKind)[keyof typeof CustomerKind]

export const SystemRoleCode = {
  Admin: 'admin',
  Operator: 'operator',
  Viewer: 'viewer',
  Client: 'client',
} as const

export type SystemRoleCode = (typeof SystemRoleCode)[keyof typeof SystemRoleCode]

export const ClientRegistrationStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
  NeedsInfo: 'needs_info',
} as const

export type ClientRegistrationStatus =
  (typeof ClientRegistrationStatus)[keyof typeof ClientRegistrationStatus]

export const ClaimOutcome = {
  Pending: 'pending',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Archived: 'archived',
} as const

export type ClaimOutcome = (typeof ClaimOutcome)[keyof typeof ClaimOutcome]

export const FaultType = {
  Employee: 'employee',
  Department: 'department',
  External: 'external',
} as const

export type FaultType = (typeof FaultType)[keyof typeof FaultType]

export const ExternalPartyKind = {
  Supplier: 'supplier',
  Subcontractor: 'subcontractor',
  Manufacturer: 'manufacturer',
  Other: 'other',
} as const

export type ExternalPartyKind = (typeof ExternalPartyKind)[keyof typeof ExternalPartyKind]

export const ClaimKind = {
  Emotive: 'emotive',
  Domace: 'domace',
} as const

export type ClaimKind = (typeof ClaimKind)[keyof typeof ClaimKind]

export const AttachmentVisibility = {
  Internal: 'internal',
  ClientVisible: 'client_visible',
} as const

export type AttachmentVisibility =
  (typeof AttachmentVisibility)[keyof typeof AttachmentVisibility]

export const ObservationVisibility = {
  Internal: 'internal',
  ClientVisible: 'client_visible',
} as const

export type ObservationVisibility =
  (typeof ObservationVisibility)[keyof typeof ObservationVisibility]

export const AppSettingValueType = {
  String: 'string',
  Number: 'number',
  Boolean: 'boolean',
  Json: 'json',
} as const

export type AppSettingValueType =
  (typeof AppSettingValueType)[keyof typeof AppSettingValueType]

export const AuditAction = {
  Create: 'create',
  Update: 'update',
  Delete: 'delete',
  Restore: 'restore',
  Login: 'login',
  Logout: 'logout',
  PermissionChange: 'permission_change',
  Export: 'export',
  Import: 'import',
} as const

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction]
