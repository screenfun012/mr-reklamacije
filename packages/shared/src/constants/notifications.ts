/** What happened. Drives the icon and the localized title of a notification. */
export const NotificationType = {
  NewSubmission: 'new_submission',
  OutcomeChanged: 'outcome_changed',
  ClaimCreated: 'claim_created',
  AssignedToMe: 'assigned_to_me',
  /** An admin-managed catalog gained an entry a worker needs (engine type, manufacturer, customer). */
  CatalogAdded: 'catalog_added',
  /** A client submission was rejected — replaces the original new_submission for the team. */
  SubmissionRejected: 'submission_rejected',
} as const

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

export const notificationTypeValues = [
  NotificationType.NewSubmission,
  NotificationType.OutcomeChanged,
  NotificationType.ClaimCreated,
  NotificationType.AssignedToMe,
  NotificationType.CatalogAdded,
  NotificationType.SubmissionRejected,
] as const

/** What the notification points at. `Catalog` has no screen to open — it is informational. */
export const NotificationEntityType = {
  ClientSubmission: 'client_submission',
  EmotiveClaim: 'emotive_claim',
  DomaceClaim: 'domace_claim',
  Catalog: 'catalog',
} as const

export type NotificationEntityType =
  (typeof NotificationEntityType)[keyof typeof NotificationEntityType]

export const notificationEntityTypeValues = [
  NotificationEntityType.ClientSubmission,
  NotificationEntityType.EmotiveClaim,
  NotificationEntityType.DomaceClaim,
  NotificationEntityType.Catalog,
] as const

/** Which catalog a `catalog_added` notification came from (only the ones that block claim entry). */
export const NotificationCatalog = {
  EngineTypes: 'engineTypes',
  EngineManufacturers: 'engineManufacturers',
  Customers: 'customers',
} as const

export type NotificationCatalog = (typeof NotificationCatalog)[keyof typeof NotificationCatalog]

export const notificationCatalogValues = [
  NotificationCatalog.EngineTypes,
  NotificationCatalog.EngineManufacturers,
  NotificationCatalog.Customers,
] as const

/** Snooze presets offered on a popup. `TomorrowMorning` resolves to 08:00 local. */
export const NotificationSnoozePreset = {
  FifteenMinutes: '15m',
  OneHour: '1h',
  ThreeHours: '3h',
  TomorrowMorning: 'tomorrow',
} as const

export type NotificationSnoozePreset =
  (typeof NotificationSnoozePreset)[keyof typeof NotificationSnoozePreset]

/** Local hour a "tomorrow morning" snooze fires at. */
export const NOTIFICATION_TOMORROW_HOUR = 8

/** Popups auto-dismiss after this long; hovering pauses the countdown. */
export const NOTIFICATION_POPUP_DURATION_MS = 8000

/** At most this many popups are stacked; the rest wait in the bell. */
export const NOTIFICATION_POPUP_MAX_VISIBLE = 3

export const NOTIFICATIONS_PAGE_SIZE = 20
