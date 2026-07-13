import { schema } from '@mr/db'
import { and, eq, isNotNull } from 'drizzle-orm'

import type { ApiDatabase } from '../database.js'

/**
 * Read-only access to admin key-value settings (`app_settings`). Values are stored as
 * serialized text; a NULL value means the setting was cleared without deleting the row.
 */
export interface AppSettingsReader {
  /** The raw string value for `key`, or null when unset/cleared. */
  getString(key: string): Promise<string | null>
}

export class DbAppSettingsReader implements AppSettingsReader {
  constructor(private readonly db: ApiDatabase) {}

  async getString(key: string): Promise<string | null> {
    const [row] = await this.db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(and(eq(schema.appSettings.key, key), isNotNull(schema.appSettings.value)))
      .limit(1)

    return row?.value ?? null
  }
}
