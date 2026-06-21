import { ClaimKind, ClaimOutcome, normalizeName } from '@mr/shared'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ForbiddenError } from '../../../core/errors/domain-errors.js'
import { InProcessEventBus } from '../../events/in-process-event-bus.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { buildTestContainer } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { ClaimsActor } from '../claims.types.js'
import type { ClaimListQuery } from '../claims.validators.js'

const FULL_OPERATOR: ClaimsActor = {
  id: TEST_USER_ID,
  permissions: [
    'emotive_claims.view',
    'emotive_claims.create',
    'domace_claims.view',
    'domace_claims.create',
  ],
}

const EMOTIVE_ONLY: ClaimsActor = {
  id: TEST_USER_ID,
  permissions: ['emotive_claims.view', 'emotive_claims.create'],
}

const DOMACE_ONLY: ClaimsActor = {
  id: TEST_USER_ID,
  permissions: ['domace_claims.view', 'domace_claims.create'],
}

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

function listQuery(overrides: Partial<ClaimListQuery> = {}): ClaimListQuery {
  return { page: 1, pageSize: 50, includeDeleted: false, ...overrides }
}

describe('ClaimsService integration', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new InProcessEventBus())
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function createEmotive(mrNumber: string): Promise<string> {
    const engineType = await container.engineTypesRepository.create({
      code: `ENG-${Date.now()}-${mrNumber}`,
    })
    const created = await container.emotiveClaimsService.create(
      {
        engineTypeId: engineType.id,
        dateOfClaim: new Date('2026-06-15'),
        mrNumber,
        outcome: ClaimOutcome.Pending,
        warrantyReport: 'Unified list emotive row',
        employeeId: await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović')),
        sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
        faults: [],
      },
      FULL_OPERATOR,
      auditContext,
    )
    return created.id
  }

  async function createDomace(mrNumber: string, customerName: string): Promise<string> {
    const created = await container.domaceClaimsService.create(
      {
        mrNumber,
        customerName,
        dateOfClaim: new Date('2026-06-15'),
        outcome: ClaimOutcome.Pending,
        faults: [],
      },
      FULL_OPERATOR,
      auditContext,
    )
    return created.id
  }

  describe('when listing unified claims', () => {
    it('returns both kinds with server-stamped kind', async () => {
      const emotiveId = await createEmotive('UNI-EM/26')
      const domaceId = await createDomace('UNI-DO/26', 'Unified Domace Kupac')

      const emotiveResult = await container.claimsService.list(
        listQuery({ search: 'UNI-EM' }),
        FULL_OPERATOR,
      )
      const domaceResult = await container.claimsService.list(
        listQuery({ search: 'UNI-DO' }),
        FULL_OPERATOR,
      )

      const emotiveRow = emotiveResult.items.find((item) => item.id === emotiveId)
      const domaceRow = domaceResult.items.find((item) => item.id === domaceId)

      expect(emotiveRow?.kind).toBe(ClaimKind.Emotive)
      expect(domaceRow?.kind).toBe(ClaimKind.Domace)
      expect(domaceRow?.customerName).toBe('Unified Domace Kupac')
    })

    it('filters by kind=domace', async () => {
      await createEmotive('ONLY-EM/26')
      await createDomace('ONLY-DO/26', 'Samo domaća')

      const result = await container.claimsService.list(
        listQuery({ kind: ClaimKind.Domace }),
        FULL_OPERATOR,
      )

      expect(result.items.every((item) => item.kind === ClaimKind.Domace)).toBe(true)
      expect(result.items.some((item) => item.customerName === 'Samo domaća')).toBe(true)
      expect(result.items.some((item) => item.mrNumber === 'ONLY-EM/26')).toBe(false)
    })

    it('filters by kind=emotive', async () => {
      await createEmotive('ONLY-EM-2/26')
      await createDomace('ONLY-DO-2/26', 'Ne bi trebalo')

      const result = await container.claimsService.list(
        listQuery({ kind: ClaimKind.Emotive }),
        FULL_OPERATOR,
      )

      expect(result.items.every((item) => item.kind === ClaimKind.Emotive)).toBe(true)
      expect(result.items.some((item) => item.mrNumber === 'ONLY-EM-2/26')).toBe(true)
    })

    it('searches mr_number across both kinds', async () => {
      await createEmotive('FINDME-EM/26')
      await createDomace('FINDME-DO/26', 'Kupac')

      const result = await container.claimsService.list(
        listQuery({ search: 'FINDME-EM' }),
        FULL_OPERATOR,
      )

      expect(result.items.some((item) => item.mrNumber === 'FINDME-EM/26')).toBe(true)
      expect(result.items.some((item) => item.mrNumber === 'FINDME-DO/26')).toBe(false)
    })

    it('paginates with a single total across both sources', async () => {
      const token = `PAGETOK${Date.now()}`
      await createEmotive(`${token}-EM/26`)
      await createDomace(`${token}-DO/26`, 'Paginacija')

      const scopedQuery = { ...listQuery(), search: token }
      const [pageOne, pageTwo] = await Promise.all([
        container.claimsService.list({ ...scopedQuery, page: 1, pageSize: 10 }, FULL_OPERATOR),
        container.claimsService.list({ ...scopedQuery, page: 2, pageSize: 10 }, FULL_OPERATOR),
      ])

      expect(pageOne.items).toHaveLength(2)
      expect(pageTwo.items).toHaveLength(0)
      expect(pageOne.total).toBe(2)
      expect(pageOne.total).toBe(pageTwo.total)
    })

    it('hides domace rows for an emotive-only actor', async () => {
      await createEmotive('EM-VIEW/26')
      await createDomace('DO-HIDE/26', 'Sakriveno')

      const result = await container.claimsService.list(listQuery(), EMOTIVE_ONLY)

      expect(result.items.every((item) => item.kind === ClaimKind.Emotive)).toBe(true)
      expect(result.items.some((item) => item.mrNumber === 'DO-HIDE/26')).toBe(false)
    })

    it('hides emotive rows for a domace-only actor', async () => {
      await createEmotive('EM-HIDE/26')
      await createDomace('DO-VIEW/26', 'Vidljivo')

      const result = await container.claimsService.list(listQuery(), DOMACE_ONLY)

      expect(result.items.every((item) => item.kind === ClaimKind.Domace)).toBe(true)
      expect(result.items.some((item) => item.mrNumber === 'DO-VIEW/26')).toBe(true)
      expect(result.items.some((item) => item.mrNumber === 'EM-HIDE/26')).toBe(false)
    })

    it('rejects kind=domace when the actor lacks domace view', async () => {
      await expect(
        container.claimsService.list(listQuery({ kind: ClaimKind.Domace }), EMOTIVE_ONLY),
      ).rejects.toThrow(ForbiddenError)
    })
  })
})
