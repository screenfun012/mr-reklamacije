import { schema } from '@mr/db'
import { AuditAction, ExternalPartyKind } from '@mr/shared'
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
const MANAGE = ['settings.external_parties.manage'] as const
const CREATE_ONLY = ['settings.external_parties.create'] as const
const CLAIMS_ONLY = ['emotive_claims.create'] as const

/** Seed a claim + fault attributing the given external party, so usageCount > 0. */
async function seedExternalPartyFault(
  ctx: TestDbContext,
  container: Container,
  externalPartyId: string,
  codeSuffix: string,
): Promise<void> {
  const manufacturer = await container.engineManufacturersRepository.create({
    code: `EP-USAGE-MFG-${codeSuffix}`,
    name: `EP Usage Mfg ${codeSuffix}`,
  })
  const engineType = await container.engineTypesRepository.create({
    code: `EP-USAGE-ENG-${codeSuffix}`,
    manufacturerId: manufacturer.id,
  })

  const [claim] = await ctx.db
    .insert(schema.emotiveClaims)
    .values({
      warrantyReport: 'External party usage test',
      engineTypeId: engineType.id,
      dateOfClaim: new Date('2026-02-01'),
      mrNumber: `MR-EP-USAGE-${codeSuffix}`,
      outcome: 'pending',
      claimYear: 2026,
      manufacturerId: manufacturer.id,
      createdBy: TEST_USER_ID,
    })
    .returning({ id: schema.emotiveClaims.id })

  await ctx.db.insert(schema.emotiveClaimFaults).values({
    claimId: claim!.id,
    faultType: 'external',
    externalPartyId,
  })
}

describe('ExternalParties module', () => {
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
    it('updates name and kind and writes audit', async () => {
      const created = await container.externalPartiesService.create(
        { name: 'Stari naziv', kind: ExternalPartyKind.Supplier },
        ACTOR,
      )

      const updated = await container.externalPartiesService.update(
        created.id,
        { name: 'Novi naziv', kind: ExternalPartyKind.Subcontractor },
        ACTOR,
      )

      expect(updated.name).toBe('Novi naziv')
      expect(updated.kind).toBe(ExternalPartyKind.Subcontractor)

      const audit = await ctx.db
        .select({ action: schema.auditLog.action })
        .from(schema.auditLog)
        .where(eq(schema.auditLog.entityId, created.id))
      expect(audit.some((row) => row.action === AuditAction.Update)).toBe(true)
    })

    it('hard-deletes an unused party', async () => {
      const created = await container.externalPartiesService.create(
        { name: 'Brisivo', kind: ExternalPartyKind.Other },
        ACTOR,
      )

      await container.externalPartiesService.hardDelete(created.id, ACTOR)

      const found = await container.externalPartiesRepository.findById(created.id)
      expect(found).toBeNull()
    })
  })

  describe('usage-count protection', () => {
    it('blocks hard delete when a fault attributes the party (409)', async () => {
      const created = await container.externalPartiesService.create(
        { name: 'Zauzeto', kind: ExternalPartyKind.Supplier },
        ACTOR,
      )
      await seedExternalPartyFault(ctx, container, created.id, 'BLOCK')

      const found = await container.externalPartiesRepository.findById(created.id)
      expect(found?.usageCount).toBeGreaterThan(0)

      await expect(
        container.externalPartiesService.hardDelete(created.id, ACTOR),
      ).rejects.toMatchObject({ status: 409 })
    })
  })

  describe('HTTP permissions', () => {
    it('lets an operator create (settings.external_parties.create → 201)', async () => {
      const app = createReferenceTestApp(container, testUser([...CREATE_ONLY], TEST_USER_ID))
      const response = await app.request('/api/external-parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Operater dodao', kind: ExternalPartyKind.Supplier }),
      })
      expect(response.status).toBe(201)
    })

    it('forbids an operator from editing (manage-only → 403)', async () => {
      const created = await container.externalPartiesService.create(
        { name: 'Edit zaštita', kind: ExternalPartyKind.Supplier },
        ACTOR,
      )
      const app = createReferenceTestApp(container, testUser([...CREATE_ONLY], TEST_USER_ID))
      const response = await app.request(`/api/external-parties/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Pokušaj izmene' }),
      })
      expect(response.status).toBe(403)
    })

    it('lets an admin (manage) edit (200)', async () => {
      const created = await container.externalPartiesService.create(
        { name: 'Admin edit', kind: ExternalPartyKind.Supplier },
        ACTOR,
      )
      const app = createReferenceTestApp(container, testUser([...MANAGE], TEST_USER_ID))
      const response = await app.request(`/api/external-parties/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Izmenjeno' }),
      })
      expect(response.status).toBe(200)
    })

    it('forbids DELETE for claim-only users (403)', async () => {
      const created = await container.externalPartiesService.create(
        { name: 'Delete zaštita', kind: ExternalPartyKind.Supplier },
        ACTOR,
      )
      const app = createReferenceTestApp(container, testUser([...CLAIMS_ONLY], TEST_USER_ID))
      const response = await app.request(`/api/external-parties/${created.id}`, {
        method: 'DELETE',
      })
      expect(response.status).toBe(403)
    })
  })
})
