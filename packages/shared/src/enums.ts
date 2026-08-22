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
  /** Shop floor, tablet only — vehicle service intake and nothing else (docs/25). */
  Serviser: 'serviser',
} as const

export type SystemRoleCode = (typeof SystemRoleCode)[keyof typeof SystemRoleCode]

export const UserAccountStatus = {
  Pending: 'pending',
  Approved: 'approved',
  Rejected: 'rejected',
} as const

export type UserAccountStatus = (typeof UserAccountStatus)[keyof typeof UserAccountStatus]

export const ClaimOutcome = {
  Pending: 'pending',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Archived: 'archived',
} as const

export type ClaimOutcome = (typeof ClaimOutcome)[keyof typeof ClaimOutcome]

/**
 * The client portal collapses the claim lifecycle into exactly three phases
 * (Received → In progress → Outcome). Internal statuses never ship to clients;
 * the server derives the phase and sends only this value.
 */
export const ClientClaimPhase = {
  Received: 'received',
  InProgress: 'in_progress',
  Outcome: 'outcome',
} as const

export type ClientClaimPhase = (typeof ClientClaimPhase)[keyof typeof ClientClaimPhase]

/**
 * Per-client-user freshness signal on the portal claim list (Phase 3): whether
 * a claim's client-visible content changed since this user last viewed it.
 * `New` = never viewed and unpublished; `Update` = changed after publish or
 * after a prior view. `null` (not part of this union) means "nothing to flag".
 */
export const ClaimFreshness = {
  New: 'new',
  Update: 'update',
} as const

export type ClaimFreshness = (typeof ClaimFreshness)[keyof typeof ClaimFreshness]

export const claimFreshnessValues = [ClaimFreshness.New, ClaimFreshness.Update] as const

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

export type AttachmentVisibility = (typeof AttachmentVisibility)[keyof typeof AttachmentVisibility]

export const AttachmentPurpose = {
  ClaimAttachment: 'claim_attachment',
  ReportImage: 'report_image',
  /**
   * The quote the serviser attaches to a finished intake — a file made in another program, never
   * line items. It shares the attachments table with the vehicle's photos, so it needs a purpose
   * of its own: an intake photo is recognised by nothing but `intake_order_id`, and without this
   * the quote would land in the photo grid and be counted by `photoCount`, which is a gate.
   */
  IntakeQuote: 'intake_quote',
} as const

export type AttachmentPurpose = (typeof AttachmentPurpose)[keyof typeof AttachmentPurpose]

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

export type AppSettingValueType = (typeof AppSettingValueType)[keyof typeof AppSettingValueType]

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

export const ClaimReportStatus = {
  Draft: 'draft',
} as const

export type ClaimReportStatus = (typeof ClaimReportStatus)[keyof typeof ClaimReportStatus]

export const ClientSubmissionStatus = {
  Pending: 'pending',
  Converted: 'converted',
  Rejected: 'rejected',
} as const

export type ClientSubmissionStatus =
  (typeof ClientSubmissionStatus)[keyof typeof ClientSubmissionStatus]

/**
 * Vehicle service intake (docs/25) — a work order's lifecycle in the shop.
 * A serviser may only step forward; the office may set any value to correct a
 * mis-tap. Unrelated to ClaimOutcome: an intake has no accept/reject.
 */
export const IntakeOrderStatus = {
  Received: 'primljeno',
  InProgress: 'u_radu',
  Done: 'gotovo',
  PickedUp: 'preuzeto',
} as const

export type IntakeOrderStatus = (typeof IntakeOrderStatus)[keyof typeof IntakeOrderStatus]

export const intakeOrderStatusValues = [
  IntakeOrderStatus.Received,
  IntakeOrderStatus.InProgress,
  IntakeOrderStatus.Done,
  IntakeOrderStatus.PickedUp,
] as const

/**
 * Which silhouette the damage map draws, and therefore which zone map applies.
 * Trucks and buses are deliberately out of scope — their zones match none of
 * these four (docs/25 §3.4).
 */
export const IntakeVehicleType = {
  Car: 'auto',
  Van: 'kombi',
  Pickup: 'kamionet',
  Suv: 'dzip',
} as const

export type IntakeVehicleType = (typeof IntakeVehicleType)[keyof typeof IntakeVehicleType]

export const intakeVehicleTypeValues = [
  IntakeVehicleType.Car,
  IntakeVehicleType.Van,
  IntakeVehicleType.Pickup,
  IntakeVehicleType.Suv,
] as const

/** How the vehicle reached the shop — drove in, towed on a truck, or dragged. */
export const IntakeArrivalMode = {
  Driven: 'dovezeno',
  Towed: 'doslepano',
  Dragged: 'dovuceno',
} as const

export type IntakeArrivalMode = (typeof IntakeArrivalMode)[keyof typeof IntakeArrivalMode]

export const intakeArrivalModeValues = [
  IntakeArrivalMode.Driven,
  IntakeArrivalMode.Towed,
  IntakeArrivalMode.Dragged,
] as const

/**
 * Who is handing the vehicle over. It exists because the identifier below it means a different thing
 * for each — an ID card for a person, a tax number for a company — and because only the person's is
 * required: a company has no ID card, so demanding one would stop an intake over a document that
 * does not exist.
 */
export const IntakeOwnerType = {
  Person: 'fizicko_lice',
  Company: 'firma',
} as const

export type IntakeOwnerType = (typeof IntakeOwnerType)[keyof typeof IntakeOwnerType]

export const intakeOwnerTypeValues = [IntakeOwnerType.Person, IntakeOwnerType.Company] as const

export const IntakeDamageType = {
  Scratch: 'ogrebotina',
  Dent: 'udubljenje',
  Cracked: 'puknuto',
  Rust: 'rdja',
} as const

export type IntakeDamageType = (typeof IntakeDamageType)[keyof typeof IntakeDamageType]

export const intakeDamageTypeValues = [
  IntakeDamageType.Scratch,
  IntakeDamageType.Dent,
  IntakeDamageType.Cracked,
  IntakeDamageType.Rust,
] as const
