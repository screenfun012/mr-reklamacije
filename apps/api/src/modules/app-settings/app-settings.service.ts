import type { AppSettingValues, AppSettingsUpdateInput } from '@mr/shared'
import { AuditAction, findAppSettingDefinition } from '@mr/shared'

import type { HttpActorContext } from '../../core/http/actor-context.js'
import type { AuditPort } from '../../core/ports/audit-port.js'
import type { AppSettingWrite, AppSettingsRepository } from './app-settings.repository.js'

export class AppSettingsService {
  constructor(
    private readonly repo: AppSettingsRepository,
    private readonly audit: AuditPort,
  ) {}

  async getOverrides(): Promise<AppSettingValues> {
    return this.repo.findOverrides()
  }

  /**
   * Applies a partial patch and audits it as ONE action, carrying only the keys that actually
   * changed — re-saving an unchanged form should not fill the history with noise.
   *
   * Defaults are never written: a key set back to its registry default is stored as NULL, so the
   * default keeps following the code instead of freezing at whatever it was on the day of the save.
   */
  async update(input: AppSettingsUpdateInput, actor: HttpActorContext): Promise<AppSettingValues> {
    const before = await this.repo.findOverrides()
    const writes: AppSettingWrite[] = []
    const changedBefore: AppSettingValues = {}
    const changedAfter: AppSettingValues = {}

    for (const [key, requested] of Object.entries(input.values)) {
      const definition = findAppSettingDefinition(key)
      if (definition === null) continue

      const currentValue = before[definition.key] ?? null
      const nextValue = requested === definition.defaultValue ? null : requested

      if (currentValue === nextValue) continue

      writes.push({ key: definition.key, value: nextValue, valueType: definition.valueType })
      changedBefore[definition.key] = currentValue
      changedAfter[definition.key] = nextValue
    }

    if (writes.length === 0) {
      return before
    }

    await this.repo.apply(writes, actor.actorUserId)

    await this.audit.log({
      entityType: 'app_settings',
      // The table has no row id — the key is its primary key, and audit_log.entity_id is a uuid.
      // Same shape the Excel export audit uses for an action that owns no row.
      entityId: actor.actorUserId,
      action: AuditAction.Update,
      actorUserId: actor.actorUserId,
      actorIp: actor.actorIp,
      actorUserAgent: actor.actorUserAgent,
      changes: { before: changedBefore, after: changedAfter },
    })

    return this.repo.findOverrides()
  }
}
