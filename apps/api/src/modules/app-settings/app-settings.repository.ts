import type { AppSettingValueType, AppSettingValues } from '@mr/shared'
import { eq } from 'drizzle-orm'

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

  /**
   * Only the overrides. An absent key means "still on the registry default".
   *
   * ⚠ A row marked `is_secret` never leaves here. Nothing uses that column yet and no setting in
   * `APP_SETTINGS` is secret — which is precisely why the refusal belongs here now rather than on
   * the day one is added: on that day nothing would break and nothing would warn, the value would
   * simply travel to everyone holding `settings.app_settings.view`, a weaker gate than the
   * `settings.app_settings.manage_secrets` written for it. `.cursor/rules/05` names secret
   * `app_settings` among the things that must never leak.
   *
   * This is the HTTP surface only. The server reads its own settings through
   * `DbAppSettingsReader`, which queries the table directly — so a secret stays usable by the code
   * that needs it while staying out of every response.
   */
  async findOverrides(): Promise<AppSettingValues> {
    const rows = await this.db
      .select({ key: appSettings.key, value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.isSecret, false))

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
