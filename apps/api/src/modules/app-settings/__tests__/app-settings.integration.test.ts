import { schema } from '@mr/db'
import { AppSettingKey, AuditAction, PORTAL_SUPPORT_PHONE } from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppVariables } from '../../../app.js'
import type { Container } from '../../../core/container.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import { DbAppSettingsReader } from '../../../core/settings/app-settings.reader.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { buildTestContainer, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { registerAppSettingsRoutes } from '../index.js'

const ACTOR = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }

function createAppSettingsTestApp(
  container: Container,
  user: ReturnType<typeof testUser> | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerAppSettingsRoutes(app, container)

  return app
}

describe('AppSettings module', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
    await ctx.db.delete(schema.appSettings)
  })

  afterEach(async () => {
    await ctx.db.delete(schema.appSettings)
    await ctx.cleanup()
  })

  describe('resolution', () => {
    it('falls back to the code default while nothing is overridden', async () => {
      const settings = await new DbAppSettingsReader(ctx.db).resolveAll()

      expect(settings.supportPhone).toBe(PORTAL_SUPPORT_PHONE)
      expect(settings.notifyClientOnOutcome).toBe(true)
      expect(await container.appSettingsService.getOverrides()).toEqual({})
    })

    it('returns the override once one is saved', async () => {
      await container.appSettingsService.update(
        { values: { [AppSettingKey.SupportPhone]: '011/222-3344' } },
        ACTOR,
      )

      const settings = await new DbAppSettingsReader(ctx.db).resolveAll()

      expect(settings.supportPhone).toBe('011/222-3344')
    })

    /**
     * `app_settings.is_secret` and the `settings.app_settings.manage_secrets` permission both exist
     * and no setting uses either yet — which is exactly why the read has to refuse now. The day a
     * service key is put in this table, nothing breaks and nothing warns: the value simply travels
     * to everyone holding `settings.app_settings.view`, which is a weaker gate than the one written
     * for it. `.cursor/rules/05` names secret `app_settings` among the things that must never leak.
     */
    it('never hands out a value marked secret', async () => {
      await ctx.db.insert(schema.appSettings).values({
        key: 'integration.secret_probe',
        value: 'super-secret-token',
        valueType: 'string',
        isSecret: true,
      })

      const overrides = await container.appSettingsService.getOverrides()

      expect(Object.values(overrides)).not.toContain('super-secret-token')
      expect(overrides).not.toHaveProperty('integration.secret_probe')
    })

    it('treats a cleared value as no override at all', async () => {
      await container.appSettingsService.update(
        { values: { [AppSettingKey.SupportPhone]: '011/222-3344' } },
        ACTOR,
      )
      await container.appSettingsService.update(
        { values: { [AppSettingKey.SupportPhone]: null } },
        ACTOR,
      )

      const settings = await new DbAppSettingsReader(ctx.db).resolveAll()

      expect(settings.supportPhone).toBe(PORTAL_SUPPORT_PHONE)
      expect(await container.appSettingsService.getOverrides()).toEqual({})
    })

    it('never freezes a default: saving the current default stores no override', async () => {
      // Otherwise the day the number changes in code, every install that once opened the screen and
      // pressed Save keeps mailing the old one, and nothing on the screen looks wrong.
      await container.appSettingsService.update(
        { values: { [AppSettingKey.SupportPhone]: PORTAL_SUPPORT_PHONE } },
        ACTOR,
      )

      expect(await container.appSettingsService.getOverrides()).toEqual({})
    })
  })

  describe('audit', () => {
    it('records one entry carrying only what changed', async () => {
      await container.appSettingsService.update(
        {
          values: {
            [AppSettingKey.SupportPhone]: '011/222-3344',
            [AppSettingKey.SupportEmail]: 'podrska@example.test',
          },
        },
        ACTOR,
      )
      // A second save that touches one of them, so the entry may not restate the other.
      await container.appSettingsService.update(
        { values: { [AppSettingKey.SupportPhone]: '011/999-0000' } },
        ACTOR,
      )

      const entries = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.entityType, 'app_settings'),
            eq(schema.auditLog.action, AuditAction.Update),
          ),
        )

      // Asserted as a set: both saves land in the same millisecond, so there is no "latest" to sort
      // to — and what matters is the CONTENT of each entry, not their order.
      const changes = entries.map((entry) => entry.changes)

      expect(entries).toHaveLength(2)
      expect(changes).toContainEqual({
        before: { [AppSettingKey.SupportPhone]: null, [AppSettingKey.SupportEmail]: null },
        after: {
          [AppSettingKey.SupportPhone]: '011/222-3344',
          [AppSettingKey.SupportEmail]: 'podrska@example.test',
        },
      })
      // The second save may not restate the address it did not touch.
      expect(changes).toContainEqual({
        before: { [AppSettingKey.SupportPhone]: '011/222-3344' },
        after: { [AppSettingKey.SupportPhone]: '011/999-0000' },
      })
    })

    it('writes nothing when the save changes nothing', async () => {
      await container.appSettingsService.update(
        { values: { [AppSettingKey.SupportPhone]: '011/222-3344' } },
        ACTOR,
      )
      await container.appSettingsService.update(
        { values: { [AppSettingKey.SupportPhone]: '011/222-3344' } },
        ACTOR,
      )

      const entries = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityType, 'app_settings'))

      expect(entries).toHaveLength(1)
    })
  })

  describe('HTTP', () => {
    it('serves the overrides and saves a patch', async () => {
      const app = createAppSettingsTestApp(
        container,
        testUser(['settings.app_settings.view', 'settings.app_settings.update']),
      )

      const empty = await app.request('/api/app-settings')
      expect(empty.status).toBe(200)
      expect(await empty.json()).toEqual({ values: {} })

      const patched = await app.request('/api/app-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ values: { [AppSettingKey.SupportEmail]: 'podrska@example.test' } }),
      })

      expect(patched.status).toBe(200)
      expect(await patched.json()).toEqual({
        values: { [AppSettingKey.SupportEmail]: 'podrska@example.test' },
      })
    })

    it('refuses an address nobody can reach, and a key that does not exist', async () => {
      const app = createAppSettingsTestApp(
        container,
        testUser(['settings.app_settings.view', 'settings.app_settings.update']),
      )

      const badEmail = await app.request('/api/app-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ values: { [AppSettingKey.SupportEmail]: 'nije-adresa' } }),
      })
      const unknownKey = await app.request('/api/app-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ values: { 'nema.ovoga': 'x' } }),
      })

      // 400, not 422: this app answers every Zod failure with 400 (`error-handler.ts`).
      expect(badEmail.status).toBe(400)
      expect(unknownKey.status).toBe(400)
      expect(await container.appSettingsService.getOverrides()).toEqual({})
    })

    it('lets a reader look but not write', async () => {
      const app = createAppSettingsTestApp(container, testUser(['settings.app_settings.view']))

      const read = await app.request('/api/app-settings')
      const write = await app.request('/api/app-settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ values: { [AppSettingKey.SupportPhone]: '011/222-3344' } }),
      })

      expect(read.status).toBe(200)
      expect(write.status).toBe(403)
    })
  })
})
