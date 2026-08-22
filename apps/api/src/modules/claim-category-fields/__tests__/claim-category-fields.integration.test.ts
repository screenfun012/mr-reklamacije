import { schema } from '@mr/db'
import { AuditAction, ResourceChangedKey } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ConflictError } from '../../../core/errors/domain-errors.js'
import {
  ensureTestUser,
  getClaimCategoryIdByCode,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import {
  buildTestContainer,
  createReferenceTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const MANAGER = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

describe('ClaimCategoryFields module', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function machiningCategoryId(): Promise<string> {
    return getClaimCategoryIdByCode(ctx.db, 'MASINSKA_OBRADA')
  }

  async function seededField(): Promise<{ id: string; options: { id: string; code: string }[] }> {
    const result = await container.claimCategoryFieldsRepository.list({
      categoryId: await machiningCategoryId(),
      activeOnly: true,
      includeOptions: true,
      limit: 50,
    })
    const field = result.items.find((item) => item.code === 'obradjeni_deo')
    if (field === undefined) {
      throw new Error('seeded field missing — migration 0046 did not run')
    }
    return {
      id: field.id,
      options: (field.options ?? []).map((option) => ({ id: option.id, code: option.code })),
    }
  }

  describe('when listing', () => {
    it('returns the seeded field with its options only when asked for them', async () => {
      const categoryId = await machiningCategoryId()

      const withOptions = await container.claimCategoryFieldsRepository.list({
        categoryId,
        activeOnly: true,
        includeOptions: true,
        limit: 50,
      })
      const field = withOptions.items.find((item) => item.code === 'obradjeni_deo')
      expect(field?.categoryName).toBe('Mašinska obrada')
      expect(field?.options?.map((option) => option.code)).toEqual([
        'glava',
        'blok',
        'radilica',
        'klipnjaca',
        'zamajac',
        'ostalo',
      ])

      const bare = await container.claimCategoryFieldsRepository.list({
        categoryId,
        activeOnly: true,
        includeOptions: false,
        limit: 50,
      })
      expect(bare.items.find((item) => item.code === 'obradjeni_deo')?.options).toBeUndefined()
    })

    it('still lists a retired option — an old claim must be able to name what it carries', async () => {
      const field = await seededField()
      const radilica = field.options.find((option) => option.code === 'radilica')
      await container.claimCategoryFieldOptionsService.update(
        radilica?.id ?? '',
        { isActive: false },
        MANAGER,
      )

      const again = await container.claimCategoryFieldsRepository.list({
        categoryId: await machiningCategoryId(),
        activeOnly: true,
        includeOptions: true,
        limit: 50,
      })
      const retired = again.items
        .find((item) => item.code === 'obradjeni_deo')
        ?.options?.find((option) => option.code === 'radilica')

      expect(retired?.isActive).toBe(false)
      expect(retired?.deactivatedAt).not.toBeNull()
    })

    it('gives the claim services every field and option of a category, retired ones included', async () => {
      const categoryId = await machiningCategoryId()
      const field = await seededField()
      await container.claimCategoryFieldsService.update(field.id, { isActive: false }, MANAGER)

      const catalog = await container.claimCategoryFieldsRepository.listForCategory(categoryId)
      const machining = catalog.find((item) => item.code === 'obradjeni_deo')

      expect(machining?.isActive).toBe(false)
      expect(machining?.options.map((option) => option.code).sort()).toEqual([
        'blok',
        'glava',
        'klipnjaca',
        'ostalo',
        'radilica',
        'zamajac',
      ])
    })
  })

  describe('when writing', () => {
    it('refuses a second field with the same code in the same category', async () => {
      await expect(
        container.claimCategoryFieldsService.create(
          { categoryId: await machiningCategoryId(), code: 'obradjeni_deo', name: 'Dupli' },
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('stamps deactivated_at on switch-off and clears it on switch-on', async () => {
      const created = await container.claimCategoryFieldsService.create(
        { categoryId: await machiningCategoryId(), code: 'tvrdoca', name: 'Tvrdoća' },
        MANAGER,
      )
      expect(created.deactivatedAt).toBeNull()

      const off = await container.claimCategoryFieldsService.update(
        created.id,
        { isActive: false },
        MANAGER,
      )
      expect(off.deactivatedAt).not.toBeNull()

      const on = await container.claimCategoryFieldsService.update(
        created.id,
        { isActive: true },
        MANAGER,
      )
      expect(on.deactivatedAt).toBeNull()
    })

    it('blocks a hard delete while a claim carries a value for the field', async () => {
      const categoryId = await machiningCategoryId()
      const field = await seededField()
      await ctx.db.insert(schema.domaceClaims).values({
        outcome: 'pending',
        claimYear: 2026,
        categoryId,
        // Stored keyed by the category the answers were entered under.
        categoryFieldValues: { [categoryId]: { obradjeni_deo: 'glava' } },
        createdBy: TEST_USER_ID,
      })

      await expect(
        container.claimCategoryFieldsService.hardDelete(field.id, MANAGER),
      ).rejects.toBeInstanceOf(ConflictError)
      expect((await container.claimCategoryFieldsRepository.findById(field.id))?.usageCount).toBe(1)
    })

    it('counts usage per category, so a same-named field elsewhere is not counted', async () => {
      // ⚙ read the top level of `category_field_values` instead of `-> <field's category id>`
      // and this goes red: the answers are keyed by category, so a same-named field in another
      // category would be counted against this one.
      const machiningId = await machiningCategoryId()
      const remontId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
      const field = await seededField()
      const elsewhere = await container.claimCategoryFieldsService.create(
        { categoryId: remontId, code: 'obradjeni_deo', name: 'Obrađeni deo (remont)' },
        MANAGER,
      )

      await ctx.db.insert(schema.domaceClaims).values({
        outcome: 'pending',
        claimYear: 2026,
        categoryId: remontId,
        categoryFieldValues: { [remontId]: { obradjeni_deo: 'glava' } },
        createdBy: TEST_USER_ID,
      })

      expect((await container.claimCategoryFieldsRepository.findById(field.id))?.usageCount).toBe(0)
      expect(
        (await container.claimCategoryFieldsRepository.findById(elsewhere.id))?.usageCount,
      ).toBe(1)
      expect(machiningId).not.toBe(remontId)
    })

    it('still counts a claim that was moved to another kind of work', async () => {
      // The claim answers for the overhaul now, but it still CARRIES what it answered here —
      // deleting the field would orphan that, so the count has to see it.
      const machiningId = await machiningCategoryId()
      const remontId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
      const field = await seededField()

      await ctx.db.insert(schema.domaceClaims).values({
        outcome: 'pending',
        claimYear: 2026,
        categoryId: remontId,
        categoryFieldValues: { [machiningId]: { obradjeni_deo: 'glava' } },
        createdBy: TEST_USER_ID,
      })

      expect((await container.claimCategoryFieldsRepository.findById(field.id))?.usageCount).toBe(1)
      await expect(
        container.claimCategoryFieldsService.hardDelete(field.id, MANAGER),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('refuses a field that still owns options, in Serbian rather than as a 500', async () => {
      // ⚙ drop the countOptions guard and this becomes an unhandled constraint error: the options
      // hold the field by a RESTRICT key. Same shape as the category one level up.
      const field = await container.claimCategoryFieldsService.create(
        { categoryId: await machiningCategoryId(), code: 'polje_sa_opcijama', name: 'Sa opcijama' },
        MANAGER,
      )
      await container.claimCategoryFieldOptionsService.create(
        { fieldId: field.id, code: 'jedna', name: 'Jedna' },
        MANAGER,
      )

      await expect(
        container.claimCategoryFieldsService.hardDelete(field.id, MANAGER),
      ).rejects.toMatchObject({ status: 409 })
      expect(await container.claimCategoryFieldsRepository.findById(field.id)).not.toBeNull()
    })

    it('audits the change and signals the whole category family', async () => {
      const bus = new RecordingEventBus()
      const recording = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, bus)

      const created = await recording.claimCategoryFieldsService.create(
        { categoryId: await machiningCategoryId(), code: 'audit_polje', name: 'Audit' },
        MANAGER,
      )

      const [entry] = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))
      expect(entry).toMatchObject({
        entityType: 'claim_category_field',
        action: AuditAction.Create,
      })
      expect(bus.resourceEvents).toContainEqual({
        type: 'resource_changed',
        resource: ResourceChangedKey.ClaimCategories,
      })
    })
  })

  describe('HTTP', () => {
    it('lists to a claims viewer and to a statistics reader', async () => {
      for (const permission of ['emotive_claims.view', 'statistics.view_emotive'] as const) {
        const response = await createReferenceTestApp(container, testUser([permission])).request(
          '/api/claim-category-fields',
        )
        expect(response.status).toBe(200)
      }
    })

    it('refuses to create without settings.claim_categories.manage', async () => {
      const response = await createReferenceTestApp(
        container,
        testUser(['emotive_claims.view']),
      ).request('/api/claim-category-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: await machiningCategoryId(),
          code: 'zabranjeno',
          name: 'Zabranjeno',
        }),
      })

      expect(response.status).toBe(403)
    })

    it('refuses a code that would not read plainly in SQL', async () => {
      const response = await createReferenceTestApp(
        container,
        testUser(['settings.claim_categories.manage']),
      ).request('/api/claim-category-fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: await machiningCategoryId(),
          code: 'Obrađeni Deo',
          name: 'Loš kod',
        }),
      })

      expect(response.status).toBe(400)
    })
  })
})
