import type { AppSettingValueType, AppSettingValues } from '@mr/shared'

import type { ApiDatabase } from '../../core/database.js'
import { appSettings } from './app-settings.schema.js'

export interface AppSettingWrite {
  readonly key: string
  /** null clears the override — the row stays, and the registry default applies again. */
  readonly value: string | null
  readonly valueType: AppSettingValueType
}

export class AppSettingsRepository {
  constructor(private readonly db: ApiDatabase) {}

  /** Only the overrides. An absent key means "still on the registry default". */
  async findOverrides(): Promise<AppSettingValues> {
    const rows = await this.db
      .select({ key: appSettings.key, value: appSettings.value })
      .from(appSettings)

    const values: Record<string, string | null> = {}
    for (const row of rows) {
      if (row.value === null) continue
      values[row.key] = row.value
    }

    return values
  }

  /** One transaction: a patch touching several settings is one admin action, not several. */
  async apply(writes: readonly AppSettingWrite[], actorUserId: string): Promise<void> {
    if (writes.length === 0) return

    await this.db.transaction(async (tx) => {
      for (const write of writes) {
        await tx
          .insert(appSettings)
          .values({
            key: write.key,
            value: write.value,
            valueType: write.valueType,
            updatedBy: actorUserId,
          })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: {
              value: write.value,
              valueType: write.valueType,
              updatedBy: actorUserId,
              updatedAt: new Date(),
            },
          })
      }
    })
  }
}
