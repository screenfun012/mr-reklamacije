import { AppSettingValueType } from '../enums.js'
import { PORTAL_SUPPORT_EMAIL, PORTAL_SUPPORT_PHONE } from './support-contact.js'

/**
 * The settings an admin may change from the panel, declared in code (docs/13: a registry, not a
 * hardcoded screen). The database holds ONLY what was overridden — a missing or NULL row means the
 * default below, so a fresh install and a reset behave identically.
 *
 * Adding one: an entry here, a label in the admin screen's map (TypeScript will demand it), and
 * whatever reads it. No migration — `app_settings` is a key-value table.
 *
 * Deliberately NOT here: anything the server needs before it can reach the database (env), and
 * anything secret. `is_secret` exists on the table but no secret setting does, which is why
 * `settings.app_settings.manage_secrets` is still unbuilt.
 */
export const AppSettingKey = {
  /** Whether a client is emailed when their EMOTIVE claim's outcome changes. */
  NotifyClientOnOutcome: 'emotive_claims.notify_client_on_outcome',
  /** Where a new client submission is announced to the office. */
  ClientSubmissionsNotifyEmail: 'client_submissions.notify_email',
  /** Shown in every email footer and in the portal support card. */
  SupportPhone: 'support.phone',
  /** Shown to signed-in clients in the portal support card. */
  SupportEmail: 'support.email',
} as const

export type AppSettingKey = (typeof AppSettingKey)[keyof typeof AppSettingKey]

export const AppSettingGroup = {
  Notifications: 'notifications',
  Support: 'support',
} as const

export type AppSettingGroup = (typeof AppSettingGroup)[keyof typeof AppSettingGroup]

export interface AppSettingDefinition {
  readonly key: AppSettingKey
  readonly group: AppSettingGroup
  readonly valueType: AppSettingValueType
  /** Serialized the way the column stores it, so a default and an override are the same shape. */
  readonly defaultValue: string
  /** A shape check beyond the type — an address nobody can reach is worse than an empty field. */
  readonly format?: 'email'
}

export const APP_SETTINGS: readonly AppSettingDefinition[] = [
  {
    key: AppSettingKey.NotifyClientOnOutcome,
    group: AppSettingGroup.Notifications,
    valueType: AppSettingValueType.Boolean,
    defaultValue: 'true',
  },
  {
    key: AppSettingKey.ClientSubmissionsNotifyEmail,
    group: AppSettingGroup.Notifications,
    valueType: AppSettingValueType.String,
    defaultValue: PORTAL_SUPPORT_EMAIL,
    format: 'email',
  },
  {
    key: AppSettingKey.SupportPhone,
    group: AppSettingGroup.Support,
    valueType: AppSettingValueType.String,
    defaultValue: PORTAL_SUPPORT_PHONE,
  },
  {
    key: AppSettingKey.SupportEmail,
    group: AppSettingGroup.Support,
    valueType: AppSettingValueType.String,
    defaultValue: PORTAL_SUPPORT_EMAIL,
    format: 'email',
  },
] as const

export function findAppSettingDefinition(key: string): AppSettingDefinition | null {
  return APP_SETTINGS.find((definition) => definition.key === key) ?? null
}

/**
 * Only the literal `'false'` turns a flag off. That is the semantics the outcome-email toggle has
 * had since it was added by hand-writing a row, and this keeps a row written that way working.
 */
export function parseAppSettingBoolean(raw: string | null, defaultValue: boolean): boolean {
  if (raw === null) return defaultValue
  return raw !== 'false'
}

export function serializeAppSettingBoolean(value: boolean): string {
  return value ? 'true' : 'false'
}
