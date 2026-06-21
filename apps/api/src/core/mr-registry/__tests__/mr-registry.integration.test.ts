import { schema } from '@mr/db'
import { ClaimKind, normalizeName } from '@mr/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MrKeyConflictError } from '../../errors/domain-errors.js'
import { MrRegistryRepository, MrRegistryService } from '../index.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

describe('MrRegistryService integration', () => {
  let ctx: TestDbContext
  let service: MrRegistryService

  beforeEach(async () => {
    ctx = await createTestDbContext()
    service = new MrRegistryService(new MrRegistryRepository(ctx.db))
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  it('claimMr inserts a registry row for a normalized MR key', async () => {
    const engineTypeId = await createEngineType(ctx)
    const claimId = await insertEmotiveClaim(ctx, engineTypeId, 'REG-CREATE/26')

    await ctx.db.transaction(async (tx) => {
      await service.claimMr('  REG-CREATE/26  ', ClaimKind.Emotive, claimId, tx)
    })

    const row = await service.findByMr('reg-create/26')
    expect(row).toEqual({ kind: ClaimKind.Emotive, claimId })
  })

  it('claimMr is a no-op when normalizeMrKey returns null', async () => {
    await ctx.db.transaction(async (tx) => {
      await service.claimMr('   ', ClaimKind.Domace, crypto.randomUUID(), tx)
    })

    expect(await service.findByMr('   ')).toBeNull()
  })

  it('claimMr throws MrKeyConflictError when MR key is already taken', async () => {
    const mrNumber = `REG-DUP-${crypto.randomUUID().slice(0, 8)}/26`
    const engineTypeId = await createEngineType(ctx)
    const firstClaimId = await insertEmotiveClaim(ctx, engineTypeId, mrNumber)
    const secondClaimId = await insertEmotiveClaim(ctx, engineTypeId, 'OTHER/26')

    await ctx.db.transaction(async (tx) => {
      await service.claimMr(mrNumber, ClaimKind.Emotive, firstClaimId, tx)
    })

    await expect(
      ctx.db.transaction(async (tx) => {
        await service.claimMr(mrNumber, ClaimKind.Emotive, secondClaimId, tx)
      }),
    ).rejects.toMatchObject({
      existingClaim: { kind: ClaimKind.Emotive, claimId: firstClaimId },
    } satisfies Partial<MrKeyConflictError>)
  })

  it('releaseMr deletes the registry row for the normalized key', async () => {
    const engineTypeId = await createEngineType(ctx)
    const claimId = await insertEmotiveClaim(ctx, engineTypeId, 'REG-RELEASE/26')

    await ctx.db.transaction(async (tx) => {
      await service.claimMr('REG-RELEASE/26', ClaimKind.Emotive, claimId, tx)
      await service.releaseMr('reg-release/26', tx)
    })

    expect(await service.findByMr('REG-RELEASE/26')).toBeNull()
  })

  it('syncMrNumberChange releases old key and claims the new key', async () => {
    const engineTypeId = await createEngineType(ctx)
    const claimId = await insertEmotiveClaim(ctx, engineTypeId, 'REG-OLD/26')

    await ctx.db.transaction(async (tx) => {
      await service.claimMr('REG-OLD/26', ClaimKind.Emotive, claimId, tx)
      await service.syncMrNumberChange(tx, ClaimKind.Emotive, claimId, 'REG-OLD/26', 'REG-NEW/26')
    })

    expect(await service.findByMr('REG-OLD/26')).toBeNull()
    expect(await service.findByMr('REG-NEW/26')).toEqual({
      kind: ClaimKind.Emotive,
      claimId,
    })
  })
})

async function createEngineType(ctx: TestDbContext): Promise<string> {
  const container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
  const created = await container.engineTypesRepository.create({
    code: `MR-REG-${crypto.randomUUID().slice(0, 8)}`,
  })
  return created.id
}

async function insertEmotiveClaim(
  ctx: TestDbContext,
  engineTypeId: string,
  mrNumber: string,
): Promise<string> {
  const employeeId = await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović'))
  const sourceId = await getClaimSourceIdByCode(ctx.db, 'SELMAN')

  const [row] = await ctx.db
    .insert(schema.emotiveClaims)
    .values({
      engineTypeId,
      dateOfClaim: new Date('2026-04-17'),
      mrNumber,
      employeeId,
      sourceId,
      outcome: 'pending',
      claimYear: 2026,
      createdBy: TEST_USER_ID,
    })
    .returning({ id: schema.emotiveClaims.id })

  const id = row?.id
  if (id === undefined) {
    throw new Error('Failed to insert emotive claim fixture')
  }

  return id
}
