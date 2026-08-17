import { schema } from '@mr/db'
import { AppSettingKey, findAppSettingDefinition, parseAppSettingBoolean } from '@mr/shared'
import { isNotNull } from 'drizzle-orm'

import type { ApiDatabase } from '../database.js'

/**
 * Every admin-configurable setting, already resolved: an override from `app_settings` when there is
 * one, the registry default otherwise. Callers get a value, never a decision — before this, each
 * one re-implemented its own `?? DEFAULT` and its own idea of what `'false'` meant.
 */
export interface ResolvedAppSettings {
  readonly notifyClientOnOutcome: boolean
  readonly clientSubmissionsNotifyEmail: string
  readonly supportPhone: string
  readonly supportEmail: string
}

export interface AppSettingsReader {
  resolveAll(): Promise<ResolvedAppSettings>
}

function defaultOf(key: AppSettingKey): string {
  const definition = findAppSettingDefinition(key)
  if (definition === null) {
    throw new Error(`No app setting definition for ${key}`)
  }
  return definition.defaultValue
}

export class DbAppSettingsReader implements AppSettingsReader {
  constructor(private readonly db: ApiDatabase) {}

  /**
   * One query for all of them: there are a handful of rows, and an email send needs two of them.
   * A NULL value means the setting was cleared without deleting the row — same as absent.
   */
  async resolveAll(): Promise<ResolvedAppSettings> {
    const rows = await this.db
      .select({ key: schema.appSettings.key, value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(isNotNull(schema.appSettings.value))

    const stored = new Map(rows.map((row) => [row.key, row.value]))
    const raw = (key: AppSettingKey): string | null => stored.get(key) ?? null
    const resolved = (key: AppSettingKey): string => raw(key) ?? defaultOf(key)

    return {
      notifyClientOnOutcome: parseAppSettingBoolean(raw(AppSettingKey.NotifyClientOnOutcome), true),
      clientSubmissionsNotifyEmail: resolved(AppSettingKey.ClientSubmissionsNotifyEmail),
      supportPhone: resolved(AppSettingKey.SupportPhone),
      supportEmail: resolved(AppSettingKey.SupportEmail),
    }
  }
}
