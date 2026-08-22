import { schema } from '@mr/db'
import { AuditAction, ResourceChangedKey } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ConflictError, ValidationError } from '../../../core/errors/domain-errors.js'
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

describe('ClaimCategoryFieldOptions module', () => {
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

  async function seededFieldId(): Promise<string> {
    const result = await container.claimCategoryFieldsRepository.list({
      categoryId: await getClaimCategoryIdByCode(ctx.db, 'MASINSKA_OBRADA'),
      activeOnly: true,
      includeOptions: false,
      limit: 50,
    })
    const field = result.items.find((item) => item.code === 'obradjeni_deo')
    if (field === undefined) {
      throw new Error('seeded field missing — migration 0046 did not run')
    }
    return field.id
  }

  /** A field of a seeded category, by code — the dependency tests need two fields of one category. */
  async function seededFieldIdIn(categoryCode: string, fieldCode: string): Promise<string> {
    const result = await container.claimCategoryFieldsRepository.list({
      categoryId: await getClaimCategoryIdByCode(ctx.db, categoryCode),
      activeOnly: false,
      includeOptions: false,
      limit: 50,
    })
    const field = result.items.find((item) => item.code === fieldCode)
    if (field === undefined) {
      throw new Error(`seeded field ${fieldCode} missing — migration 0048 did not run`)
    }
    return field.id
  }

  async function seededOptionIdIn(fieldId: string, optionCode: string): Promise<string> {
    const result = await container.claimCategoryFieldOptionsRepository.list({
      fieldId,
      activeOnly: false,
      limit: 50,
    })
    const option = result.items.find((item) => item.code === optionCode)
    if (option === undefined) {
      throw new Error(`seeded option ${optionCode} missing — migration 0048 did not run`)
    }
    return option.id
  }

  describe('when listing', () => {
    it('returns the seeded options of one field in catalogue order, with the field named', async () => {
      const result = await container.claimCategoryFieldOptionsRepository.list({
        fieldId: await seededFieldId(),
        activeOnly: true,
        limit: 50,
      })

      expect(result.items.map((item) => item.code)).toEqual([
        'glava',
        'blok',
        'radilica',
        'klipnjaca',
        'zamajac',
        'ostalo',
      ])
      expect(result.items[0]?.fieldName).toBe('Obrađeni deo')
    })
  })

  describe('when writing', () => {
    it('refuses a second option with the same code on the same field', async () => {
      await expect(
        container.claimCategoryFieldOptionsService.create(
          { fieldId: await seededFieldId(), code: 'glava', name: 'Duplikat' },
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('lets the office add the values Nikola asked for, and stamps a retirement date', async () => {
      const fieldId = await seededFieldId()

      const deklo = await container.claimCategoryFieldOptionsService.create(
        { fieldId, code: 'deklo', name: 'Deklo', sortOrder: 40 },
        MANAGER,
      )
      expect(deklo.deactivatedAt).toBeNull()

      const off = await container.claimCategoryFieldOptionsService.update(
        deklo.id,
        { isActive: false },
        MANAGER,
      )
      expect(off.deactivatedAt).not.toBeNull()

      const on = await container.claimCategoryFieldOptionsService.update(
        deklo.id,
        { isActive: true },
        MANAGER,
      )
      expect(on.deactivatedAt).toBeNull()
    })

    it('blocks a hard delete while a claim carries the value', async () => {
      const fieldId = await seededFieldId()
      const options = await container.claimCategoryFieldOptionsRepository.list({
        fieldId,
        activeOnly: true,
        limit: 50,
      })
      const glava = options.items.find((item) => item.code === 'glava')

      const machiningId = await getClaimCategoryIdByCode(ctx.db, 'MASINSKA_OBRADA')
      await ctx.db.insert(schema.domaceClaims).values({
        outcome: 'pending',
        claimYear: 2026,
        categoryId: machiningId,
        categoryFieldValues: { [machiningId]: { obradjeni_deo: 'glava' } },
        createdBy: TEST_USER_ID,
      })

      await expect(
        container.claimCategoryFieldOptionsService.hardDelete(glava?.id ?? '', MANAGER),
      ).rejects.toBeInstanceOf(ConflictError)
      expect(
        (await container.claimCategoryFieldOptionsRepository.findById(glava?.id ?? ''))?.usageCount,
      ).toBe(1)
    })

    it('audits the change and signals the whole category family', async () => {
      const bus = new RecordingEventBus()
      const recording = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, bus)

      const created = await recording.claimCategoryFieldOptionsService.create(
        { fieldId: await seededFieldId(), code: 'karter', name: 'Karter', sortOrder: 50 },
        MANAGER,
      )

      const [entry] = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))
      expect(entry).toMatchObject({
        entityType: 'claim_category_field_option',
        action: AuditAction.Create,
      })
      expect(bus.resourceEvents).toContainEqual({
        type: 'resource_changed',
        resource: ResourceChangedKey.ClaimCategories,
      })
    })
  })

  describe('when an option hangs off another option', () => {
    it('refuses a parent from another category', async () => {
      const machiningPart = await seededFieldIdIn('MASINSKA_OBRADA', 'obradjeni_deo')

      await expect(
        container.claimCategoryFieldOptionsService.create(
          {
            fieldId: await seededFieldIdIn('REMONT_MOTORA', 'pojava_kvara'),
            code: 'ventili',
            name: 'Ventili ne zaptivaju',
            parentOptionId: await seededOptionIdIn(machiningPart, 'glava'),
          },
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('refuses a parent from the SAME field', async () => {
      const partField = await seededFieldIdIn('REMONT_MOTORA', 'sklop_u_kvaru')

      await expect(
        container.claimCategoryFieldOptionsService.create(
          {
            fieldId: partField,
            code: 'polomljen',
            name: 'Polomljen',
            parentOptionId: await seededOptionIdIn(partField, 'glava'),
          },
          MANAGER,
        ),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('refuses an option as its own parent on update', async () => {
      const faultField = await seededFieldIdIn('REMONT_MOTORA', 'pojava_kvara')
      const own = await seededOptionIdIn(faultField, 'buka')

      await expect(
        container.claimCategoryFieldOptionsService.update(own, { parentOptionId: own }, MANAGER),
      ).rejects.toBeInstanceOf(ValidationError)
    })

    it('serves the parent field and option CODES on the list, and lets an update clear them', async () => {
      const partField = await seededFieldIdIn('REMONT_MOTORA', 'sklop_u_kvaru')
      const faultField = await seededFieldIdIn('REMONT_MOTORA', 'pojava_kvara')
      const glava = await seededOptionIdIn(partField, 'glava')

      const created = await container.claimCategoryFieldOptionsService.create(
        {
          fieldId: faultField,
          code: 'ventili',
          name: 'Ventili ne zaptivaju',
          parentOptionId: glava,
          sortOrder: 90,
        },
        MANAGER,
      )
      expect(created).toMatchObject({
        parentOptionId: glava,
        parentFieldCode: 'sklop_u_kvaru',
        parentOptionCode: 'glava',
      })

      const listed = await container.claimCategoryFieldOptionsRepository.list({
        fieldId: faultField,
        activeOnly: false,
        limit: 50,
      })
      expect(listed.items.find((item) => item.code === 'ventili')).toMatchObject({
        parentFieldCode: 'sklop_u_kvaru',
        parentOptionCode: 'glava',
      })
      expect(listed.items.find((item) => item.code === 'buka')?.parentOptionId).toBeNull()

      const cleared = await container.claimCategoryFieldOptionsService.update(
        created.id,
        { parentOptionId: null },
        MANAGER,
      )
      expect(cleared.parentOptionId).toBeNull()
      expect(cleared.parentOptionCode).toBeNull()
    })

    it('gives the claims port the parent, retired parents included', async () => {
      const categoryId = await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA')
      const partField = await seededFieldIdIn('REMONT_MOTORA', 'sklop_u_kvaru')
      const glava = await seededOptionIdIn(partField, 'glava')

      await container.claimCategoryFieldOptionsService.create(
        {
          fieldId: await seededFieldIdIn('REMONT_MOTORA', 'pojava_kvara'),
          code: 'ventili',
          name: 'Ventili ne zaptivaju',
          parentOptionId: glava,
        },
        MANAGER,
      )
      // The parent goes out of the catalogue: a claim that carries the child still has to read.
      await container.claimCategoryFieldOptionsService.update(glava, { isActive: false }, MANAGER)

      const fields = await container.claimCategoryFieldsRepository.listForCategory(categoryId)
      const faultOptions = fields.find((field) => field.code === 'pojava_kvara')?.options ?? []
      expect(faultOptions.find((option) => option.code === 'ventili')?.parent).toEqual({
        fieldCode: 'sklop_u_kvaru',
        optionCode: 'glava',
      })
      expect(faultOptions.find((option) => option.code === 'buka')?.parent).toBeNull()
    })
  })

  describe('HTTP', () => {
    it('lists to a claims viewer and refuses a create without the settings permission', async () => {
      const ok = await createReferenceTestApp(container, testUser(['emotive_claims.view'])).request(
        '/api/claim-category-field-options',
      )
      expect(ok.status).toBe(200)

      const forbidden = await createReferenceTestApp(
        container,
        testUser(['emotive_claims.view']),
      ).request('/api/claim-category-field-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fieldId: await seededFieldId(), code: 'x', name: 'X' }),
      })
      expect(forbidden.status).toBe(403)
    })
  })
})
