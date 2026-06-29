import { schema } from '@mr/db'
import { AuditAction } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import {
  buildTestContainer,
  createReferenceTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const ACTOR = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }
const MANAGE = ['settings.claim_sources.manage'] as const
const CLAIMS_ONLY = ['emotive_claims.create'] as const

async function seedClaimForSource(
  ctx: TestDbContext,
  container: Container,
  sourceId: string,
  codeSuffix: string,
): Promise<void> {
  const manufacturer = await container.engineManufacturersRepository.create({
    code: `CS-USAGE-MFG-${codeSuffix}`,
    name: `CS Usage Mfg ${codeSuffix}`,
  })
  const engineType = await container.engineTypesRepository.create({
    code: `CS-USAGE-ENG-${codeSuffix}`,
    manufacturerId: manufacturer.id,
  })

  await ctx.db.insert(schema.emotiveClaims).values({
    warrantyReport: 'Claim source usage test',
    engineTypeId: engineType.id,
    dateOfClaim: new Date('2026-02-01'),
    mrNumber: `MR-CS-USAGE-${codeSuffix}`,
    outcome: 'pending',
    claimYear: 2026,
    manufacturerId: manufacturer.id,
    sourceId,
    createdBy: TEST_USER_ID,
  })
}

describe('ClaimSources module', () => {
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

  describe('service CRUD', () => {
    it('creates a source with a default customer and writes audit', async () => {
      const customer = await container.customersRepository.create({ name: 'Podrazumevana Co' })

      const created = await container.claimSourcesService.create(
        {
          code: 'CS-CREATE',
          name: 'Uvoz EU',
          defaultCustomerId: customer.id,
          claimNumberPrefix: 'EU',
        },
        ACTOR,
      )

      expect(created.usageCount).toBe(0)
      expect(created.defaultCustomer).toEqual({ id: customer.id, name: 'Podrazumevana Co' })
      expect(created.claimNumberPrefix).toBe('EU')

      const audit = await ctx.db
        .select({ action: schema.auditLog.action })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))
      expect(audit.some((row) => row.action === AuditAction.Create)).toBe(true)
    })

    it('rejects a non-existent default customer with 400', async () => {
      await expect(
        container.claimSourcesService.create(
          {
            code: 'CS-BAD-CUST',
            name: 'X',
            defaultCustomerId: '00000000-0000-4000-8000-000000000000',
          },
          ACTOR,
        ),
      ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects a duplicate code with 409', async () => {
      await container.claimSourcesService.create({ code: 'CS-DUP', name: 'A' }, ACTOR)

      await expect(
        container.claimSourcesService.create({ code: 'CS-DUP', name: 'B' }, ACTOR),
      ).rejects.toMatchObject({ status: 409 })
    })

    it('updates and clears the default customer and number prefix', async () => {
      const customer = await container.customersRepository.create({ name: 'Privremena Co' })
      const created = await container.claimSourcesService.create(
        { code: 'CS-CLEAR', name: 'Izvor', defaultCustomerId: customer.id, claimNumberPrefix: 'P' },
        ACTOR,
      )

      const updated = await container.claimSourcesService.update(
        created.id,
        { defaultCustomerId: null, claimNumberPrefix: null },
        ACTOR,
      )

      expect(updated.defaultCustomer).toBeNull()
      expect(updated.defaultCustomerId).toBeNull()
      expect(updated.claimNumberPrefix).toBeNull()
    })
  })

  describe('usage-count protection', () => {
    it('blocks hard delete when an EMOTIVE claim uses the source (409)', async () => {
      const created = await container.claimSourcesService.create(
        { code: 'CS-USED', name: 'Zauzeto' },
        ACTOR,
      )
      await seedClaimForSource(ctx, container, created.id, 'BLOCK')

      const found = await container.claimSourcesRepository.findById(created.id)
      expect(found?.usageCount).toBeGreaterThan(0)

      await expect(
        container.claimSourcesService.hardDelete(created.id, ACTOR),
      ).rejects.toMatchObject({ status: 409 })
    })
  })

  describe('HTTP permissions (admin-only management)', () => {
    it('allows GET for internal claim editors', async () => {
      const app = createReferenceTestApp(container, testUser([...CLAIMS_ONLY], TEST_USER_ID))
      const response = await app.request('/api/claim-sources')
      expect(response.status).toBe(200)
    })

    it('rejects POST without settings.claim_sources.manage (403)', async () => {
      const app = createReferenceTestApp(container, testUser([...CLAIMS_ONLY], TEST_USER_ID))
      const response = await app.request('/api/claim-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'CS-403', name: 'X' }),
      })
      expect(response.status).toBe(403)
    })

    it('allows POST with settings.claim_sources.manage (201)', async () => {
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))
      const response = await app.request('/api/claim-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'CS-201', name: 'OK' }),
      })
      expect(response.status).toBe(201)
    })

    it('rejects DELETE without manage (403)', async () => {
      const created = await container.claimSourcesService.create(
        { code: 'CS-DEL-403', name: 'X' },
        ACTOR,
      )
      const app = createReferenceTestApp(container, testUser([...CLAIMS_ONLY], TEST_USER_ID))
      const response = await app.request(`/api/claim-sources/${created.id}`, { method: 'DELETE' })
      expect(response.status).toBe(403)
    })
  })
})
