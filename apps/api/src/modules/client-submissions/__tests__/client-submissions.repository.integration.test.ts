import { schema } from '@mr/db'
import { ClaimOutcome, ClientSubmissionStatus, CustomerKind } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { ClientSubmissionsRepository } from '../client-submissions.repository.js'

async function seedCustomer(ctx: TestDbContext, name: string): Promise<string> {
  const [customer] = await ctx.db
    .insert(schema.customers)
    .values({ kind: CustomerKind.EmotivePartner, name })
    .returning({ id: schema.customers.id })

  return customer!.id
}

async function seedAttachment(
  ctx: TestDbContext,
  submissionId: string,
  options: { deleted?: boolean } = {},
): Promise<void> {
  await ctx.db.insert(schema.attachments).values({
    clientSubmissionId: submissionId,
    fileName: 'photo.jpg',
    storagePath: `client-submissions/${submissionId}/photo.jpg`,
    mimeType: 'image/jpeg',
    fileSizeBytes: 1024,
    ...(options.deleted === true ? { deletedAt: new Date() } : {}),
  })
}

/** A real EMOTIVE claim to satisfy the linked_emotive_claim_id FK on conversion. */
async function seedEmotiveClaim(ctx: TestDbContext, codeSuffix: string): Promise<string> {
  const [engineType] = await ctx.db
    .insert(schema.engineTypes)
    .values({ code: `CS-ENG-${codeSuffix}` })
    .returning({ id: schema.engineTypes.id })

  const [claim] = await ctx.db
    .insert(schema.emotiveClaims)
    .values({
      warrantyReport: 'Converted from submission',
      engineTypeId: engineType!.id,
      dateOfClaim: new Date('2026-02-01'),
      mrNumber: `MR-CS-${codeSuffix}`,
      outcome: ClaimOutcome.Pending,
      claimYear: 2026,
      createdBy: TEST_USER_ID,
    })
    .returning({ id: schema.emotiveClaims.id })

  return claim!.id
}

describe('ClientSubmissionsRepository', () => {
  let ctx: TestDbContext
  let repository: ClientSubmissionsRepository

  beforeEach(async () => {
    ctx = await createTestDbContext()
    repository = new ClientSubmissionsRepository(ctx.db)
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('creates a submission and lists it as pending with customer name', async () => {
    const customerId = await seedCustomer(ctx, 'Partner GmbH')

    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message: 'Motor lupa nakon ugradnje',
    })

    const { items, total } = await repository.listPending({ page: 1, pageSize: 10 })

    expect(total).toBe(1)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      id,
      customerId,
      customerName: 'Partner GmbH',
      message: 'Motor lupa nakon ugradnje',
      status: ClientSubmissionStatus.Pending,
      attachmentCount: 0,
    })
    expect(typeof items[0]!.createdAt).toBe('string')
  })

  it('counts only live attachments per submission', async () => {
    const customerId = await seedCustomer(ctx, 'Partner sa prilozima')
    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message: 'Sa dve slike',
    })

    await seedAttachment(ctx, id)
    await seedAttachment(ctx, id)
    await seedAttachment(ctx, id, { deleted: true })

    const { items } = await repository.listPending({ page: 1, pageSize: 10 })

    expect(items[0]!.attachmentCount).toBe(2)
  })

  it('paginates and orders newest first', async () => {
    const customerId = await seedCustomer(ctx, 'Partner puno')

    for (let i = 0; i < 3; i += 1) {
      await ctx.db.insert(schema.clientSubmissions).values({
        customerId,
        submittedByUserId: TEST_USER_ID,
        message: `Poruka ${i}`,
        createdAt: new Date(`2026-03-0${i + 1}T00:00:00Z`),
      })
    }

    const firstPage = await repository.listPending({ page: 1, pageSize: 2 })
    expect(firstPage.total).toBe(3)
    expect(firstPage.items).toHaveLength(2)
    expect(firstPage.items[0]!.message).toBe('Poruka 2')

    const secondPage = await repository.listPending({ page: 2, pageSize: 2 })
    expect(secondPage.items).toHaveLength(1)
    expect(secondPage.items[0]!.message).toBe('Poruka 0')
  })

  it('markConverted removes the submission from the pending list and sets fields', async () => {
    const customerId = await seedCustomer(ctx, 'Partner za konverziju')
    const claimId = await seedEmotiveClaim(ctx, 'CONV')
    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message: 'Za konverziju',
    })

    await repository.markConverted(id, claimId, TEST_USER_ID)

    const { total } = await repository.listPending({ page: 1, pageSize: 10 })
    expect(total).toBe(0)

    const detail = await repository.findById(id)
    expect(detail).not.toBeNull()
    expect(detail).toMatchObject({
      id,
      status: ClientSubmissionStatus.Converted,
      linkedEmotiveClaimId: claimId,
      rejectedReason: null,
    })
    expect(detail!.handledAt).not.toBeNull()
  })

  it('markConverted is a no-op on an already-converted submission (double-convert guard)', async () => {
    const customerId = await seedCustomer(ctx, 'Partner dupli convert')
    const claimA = await seedEmotiveClaim(ctx, 'DUPA')
    const claimB = await seedEmotiveClaim(ctx, 'DUPB')
    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message: 'Dupli convert',
    })

    const first = await repository.markConverted(id, claimA, TEST_USER_ID)
    expect(first).toBe(1)

    // The racer / retry: the submission is already converted, so the guard matches 0 rows
    // and the link is NOT overwritten to claimB.
    const second = await repository.markConverted(id, claimB, TEST_USER_ID)
    expect(second).toBe(0)

    const detail = await repository.findById(id)
    expect(detail).toMatchObject({
      status: ClientSubmissionStatus.Converted,
      linkedEmotiveClaimId: claimA,
    })
  })

  it('markRejected sets status and reason', async () => {
    const customerId = await seedCustomer(ctx, 'Partner za odbijanje')
    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message: 'Za odbijanje',
    })

    await repository.markRejected(id, 'Nije garancijski slučaj', TEST_USER_ID)

    const { total } = await repository.listPending({ page: 1, pageSize: 10 })
    expect(total).toBe(0)

    const detail = await repository.findById(id)
    expect(detail).toMatchObject({
      status: ClientSubmissionStatus.Rejected,
      rejectedReason: 'Nije garancijski slučaj',
      linkedEmotiveClaimId: null,
    })
    expect(detail!.handledAt).not.toBeNull()
  })

  it('markRejected accepts a null reason', async () => {
    const customerId = await seedCustomer(ctx, 'Partner bez razloga')
    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message: 'Odbijeno bez razloga',
    })

    await repository.markRejected(id, null, TEST_USER_ID)

    const detail = await repository.findById(id)
    expect(detail).toMatchObject({
      status: ClientSubmissionStatus.Rejected,
      rejectedReason: null,
    })
  })

  it('findById returns the full detail projection', async () => {
    const customerId = await seedCustomer(ctx, 'Partner detalji')
    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message: 'Detalji',
    })
    await seedAttachment(ctx, id)

    const detail = await repository.findById(id)

    expect(detail).toMatchObject({
      id,
      customerId,
      customerName: 'Partner detalji',
      message: 'Detalji',
      status: ClientSubmissionStatus.Pending,
      attachmentCount: 1,
      linkedEmotiveClaimId: null,
      rejectedReason: null,
      handledAt: null,
      submittedByUserId: TEST_USER_ID,
    })
  })

  it('findById returns null for a missing id', async () => {
    const detail = await repository.findById('00000000-0000-4000-8000-0000000000ff')
    expect(detail).toBeNull()
  })

  it('findById returns null for a soft-deleted submission', async () => {
    const customerId = await seedCustomer(ctx, 'Partner obrisan')
    const { id } = await repository.create({
      customerId,
      submittedByUserId: TEST_USER_ID,
      message: 'Obrisano',
    })
    await ctx.db
      .update(schema.clientSubmissions)
      .set({ deletedAt: new Date() })
      .where(eq(schema.clientSubmissions.id, id))

    expect(await repository.findById(id)).toBeNull()
  })
})
