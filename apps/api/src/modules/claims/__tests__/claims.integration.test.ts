import { schema } from '@mr/db'
import {
  ClaimKind,
  ClaimOutcome,
  ClaimSortBy,
  ClaimSortDir,
  normalizeName,
  SYSTEM_ROLE_CLIENT,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ForbiddenError } from '../../../core/errors/domain-errors.js'
import { InProcessEventBus } from '../../events/in-process-event-bus.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getCustomerIdByName,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { createTestEngineType } from '../../../test-helpers/engine-type-fixtures.js'
import {
  buildTestContainer,
  createClaimsTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
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

  async function createEmotive(
    mrNumber: string,
    options: { dateOfClaim?: Date; dateOfFinish?: Date } = {},
  ): Promise<string> {
    const engineType = await createTestEngineType(container, `ENG-${Date.now()}-${mrNumber}`)
    const created = await container.emotiveClaimsService.create(
      {
        engineTypeId: engineType.id,
        dateOfClaim: options.dateOfClaim ?? new Date('2026-06-15'),
        dateOfFinish: options.dateOfFinish,
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

  async function createDomace(
    mrNumber: string,
    customerName: string,
    options: { dateOfClaim?: Date | null; dateOfFinish?: Date | null } = {},
  ): Promise<string> {
    const created = await container.domaceClaimsService.create(
      {
        mrNumber,
        customerName,
        dateOfClaim:
          options.dateOfClaim === null
            ? undefined
            : (options.dateOfClaim ?? new Date('2026-06-15')),
        dateOfFinish: options.dateOfFinish === null ? undefined : options.dateOfFinish,
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

  describe('when sorting unified claims', () => {
    const sortToken = () => `SORT-${Date.now()}`

    it('keeps default order by date_of_claim desc when sort params are omitted', async () => {
      const token = sortToken()
      await createEmotive(`${token}-OLD/26`, { dateOfClaim: new Date('2026-06-01') })
      await createEmotive(`${token}-NEW/26`, { dateOfClaim: new Date('2026-06-30') })
      await createEmotive(`${token}-MID/26`, { dateOfClaim: new Date('2026-06-15') })

      const result = await container.claimsService.list(listQuery({ search: token }), FULL_OPERATOR)

      expect(result.items.map((item) => item.mrNumber)).toEqual([
        `${token}-NEW/26`,
        `${token}-MID/26`,
        `${token}-OLD/26`,
      ])
    })

    it('sorts by dateOfClaim ascending', async () => {
      const token = sortToken()
      await createEmotive(`${token}-OLD/26`, { dateOfClaim: new Date('2026-06-01') })
      await createEmotive(`${token}-NEW/26`, { dateOfClaim: new Date('2026-06-30') })
      await createEmotive(`${token}-MID/26`, { dateOfClaim: new Date('2026-06-15') })

      const result = await container.claimsService.list(
        listQuery({
          search: token,
          sortBy: ClaimSortBy.DateOfClaim,
          sortDir: ClaimSortDir.Asc,
        }),
        FULL_OPERATOR,
      )

      expect(result.items.map((item) => item.mrNumber)).toEqual([
        `${token}-OLD/26`,
        `${token}-MID/26`,
        `${token}-NEW/26`,
      ])
    })

    it('sorts by dateOfClaim descending', async () => {
      const token = sortToken()
      await createEmotive(`${token}-OLD/26`, { dateOfClaim: new Date('2026-06-01') })
      await createEmotive(`${token}-NEW/26`, { dateOfClaim: new Date('2026-06-30') })

      const result = await container.claimsService.list(
        listQuery({
          search: token,
          sortBy: ClaimSortBy.DateOfClaim,
          sortDir: ClaimSortDir.Desc,
        }),
        FULL_OPERATOR,
      )

      expect(result.items.map((item) => item.mrNumber)).toEqual([
        `${token}-NEW/26`,
        `${token}-OLD/26`,
      ])
    })

    it('sorts by dateOfFinish ascending with null finish dates last', async () => {
      const token = sortToken()
      const earlyId = await createEmotive(`${token}-EARLY/26`, {
        dateOfClaim: new Date('2026-06-15'),
        dateOfFinish: new Date('2026-06-01'),
      })
      const lateId = await createEmotive(`${token}-LATE/26`, {
        dateOfClaim: new Date('2026-06-15'),
        dateOfFinish: new Date('2026-06-30'),
      })
      const nullFinishId = await createDomace(`${token}-NULL/26`, 'Null finish', {
        dateOfClaim: new Date('2026-06-15'),
        dateOfFinish: null,
      })

      const result = await container.claimsService.list(
        listQuery({
          search: token,
          sortBy: ClaimSortBy.DateOfFinish,
          sortDir: ClaimSortDir.Asc,
        }),
        FULL_OPERATOR,
      )

      expect(result.items.map((item) => item.id)).toEqual([earlyId, lateId, nullFinishId])
    })

    it('sorts by dateOfFinish descending with null finish dates last', async () => {
      const token = sortToken()
      const earlyId = await createEmotive(`${token}-EARLY/26`, {
        dateOfClaim: new Date('2026-06-15'),
        dateOfFinish: new Date('2026-06-01'),
      })
      const lateId = await createEmotive(`${token}-LATE/26`, {
        dateOfClaim: new Date('2026-06-15'),
        dateOfFinish: new Date('2026-06-30'),
      })
      const nullFinishId = await createDomace(`${token}-NULL/26`, 'Null finish', {
        dateOfClaim: new Date('2026-06-15'),
        dateOfFinish: null,
      })

      const result = await container.claimsService.list(
        listQuery({
          search: token,
          sortBy: ClaimSortBy.DateOfFinish,
          sortDir: ClaimSortDir.Desc,
        }),
        FULL_OPERATOR,
      )

      expect(result.items.map((item) => item.id)).toEqual([lateId, earlyId, nullFinishId])
    })

    it('places null date_of_claim rows last when sorting ascending by dateOfClaim', async () => {
      const token = sortToken()
      const datedId = await createEmotive(`${token}-DATED/26`, {
        dateOfClaim: new Date('2026-06-10'),
      })
      const nullClaimId = await createDomace(`${token}-NODATE/26`, 'Bez datuma', {
        dateOfClaim: null,
      })

      const result = await container.claimsService.list(
        listQuery({
          search: token,
          sortBy: ClaimSortBy.DateOfClaim,
          sortDir: ClaimSortDir.Asc,
        }),
        FULL_OPERATOR,
      )

      expect(result.items.map((item) => item.id)).toEqual([datedId, nullClaimId])
    })
  })

  describe('GET /api/claims — client whitelist (portal list endpoint)', () => {
    it('strips handler/internal fields for a client and only returns their company', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()

      const engineType = await createTestEngineType(container, `ENG-CLIENT-${Date.now()}`)
      await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          dateOfClaim: new Date('2026-06-15'),
          mrNumber: `UNIFIED-CLIENT-${Date.now()}/26`,
          outcome: ClaimOutcome.Pending,
          warrantyReport: 'unified-client-wl',
          employeeId: await getEmployeeIdByNormalizedName(
            ctx.db,
            normalizeName('Dejan Milovanović'),
          ),
          sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
          customerId: customerSelman,
          faults: [],
        },
        FULL_OPERATOR,
        auditContext,
      )

      const app = createClaimsTestApp(
        container,
        testUser(
          ['emotive_claims.view_own_customer', 'domace_claims.view_own_customer'],
          TEST_USER_ID,
          [SYSTEM_ROLE_CLIENT],
        ),
      )
      const res = await app.request(`/api/claims?page=1&pageSize=50&customerId=${customerSelman}`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: Array<Record<string, unknown>> }
      expect(body.items.length).toBeGreaterThan(0)
      for (const item of body.items) {
        for (const key of ['employeeName', 'employeeId', 'sourceId', 'customerId']) {
          expect(key in item).toBe(false)
        }
        expect(item['kind']).toBe('emotive')
        // Portal status derives from `outcome` (no redundant progressPhase field);
        // archived claims are hidden from clients, so outcome is pending/decided.
        expect('progressPhase' in item).toBe(false)
        expect(['pending', 'accepted', 'rejected']).toContain(item['outcome'])
      }
    })

    it('scopes a client to their OWN customer — never leaks another customer’s claims (no customerId filter)', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      const customerVitobello = await getCustomerIdByName(ctx.db, 'VITOBELLO')

      // TEST_USER (the client) is linked to SELMAN only.
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()

      const engineType = await createTestEngineType(container, `ENG-SCOPE-${Date.now()}`)
      const selmanSource = await getClaimSourceIdByCode(ctx.db, 'SELMAN')
      const own = await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          dateOfClaim: new Date('2026-06-15'),
          mrNumber: `SCOPE-OWN-${Date.now()}/26`,
          outcome: ClaimOutcome.Pending,
          warrantyReport: 'scope-own',
          sourceId: selmanSource,
          customerId: customerSelman,
          faults: [],
        },
        FULL_OPERATOR,
        auditContext,
      )
      const foreign = await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          dateOfClaim: new Date('2026-06-15'),
          mrNumber: `SCOPE-FOREIGN-${Date.now()}/26`,
          outcome: ClaimOutcome.Pending,
          warrantyReport: 'scope-foreign',
          sourceId: selmanSource,
          customerId: customerVitobello,
          faults: [],
        },
        FULL_OPERATOR,
        auditContext,
      )

      const app = createClaimsTestApp(
        container,
        testUser(
          ['emotive_claims.view_own_customer', 'domace_claims.view_own_customer'],
          TEST_USER_ID,
          [SYSTEM_ROLE_CLIENT],
        ),
      )
      // NO customerId filter — the own_customer SCOPE alone must exclude the foreign claim.
      const res = await app.request('/api/claims?page=1&pageSize=50')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: Array<{ id: string; kind: string }> }
      const ids = body.items.map((item) => item.id)
      expect(ids).toContain(own.id)
      expect(ids).not.toContain(foreign.id)
      // A client is an emotive partner — no domace claims leak into the unified list.
      expect(body.items.every((item) => item.kind === 'emotive')).toBe(true)
    })

    it('hides archived claims from the client list but keeps them for internal users', async () => {
      const clientUserId = '55555555-5555-4555-8555-555555555554'
      await ensureTestUser(ctx.db, clientUserId)
      const [customer] = await ctx.db
        .insert(schema.customers)
        .values({ kind: 'emotive_partner', name: `CLAIMS-ARCH-${Date.now()}` })
        .returning({ id: schema.customers.id })
      if (customer === undefined) {
        throw new Error('failed to insert test customer')
      }
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customer.id, userId: clientUserId, assignedBy: TEST_USER_ID })

      const engineType = await createTestEngineType(container, `ENG-ARCH-${Date.now()}`)
      const created = await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          dateOfClaim: new Date('2026-06-15'),
          mrNumber: `ARCH-CLIENT-${Date.now()}/26`,
          outcome: ClaimOutcome.Pending,
          warrantyReport: 'archived-visibility',
          sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
          customerId: customer.id,
          faults: [],
        },
        FULL_OPERATOR,
        auditContext,
      )
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ outcome: ClaimOutcome.Archived })
        .where(eq(schema.emotiveClaims.id, created.id))

      const clientApp = createClaimsTestApp(
        container,
        testUser(
          ['emotive_claims.view_own_customer', 'domace_claims.view_own_customer'],
          clientUserId,
          [SYSTEM_ROLE_CLIENT],
        ),
      )
      const clientRes = await clientApp.request('/api/claims?page=1&pageSize=50')
      expect(clientRes.status).toBe(200)
      const clientBody = (await clientRes.json()) as { items: Array<{ id: string }> }
      expect(clientBody.items.some((item) => item.id === created.id)).toBe(false)

      // Internal full-view actors still see the archived row.
      const internalResult = await container.claimsService.list(
        listQuery({ outcome: ClaimOutcome.Archived, customerId: customer.id }),
        FULL_OPERATOR,
      )
      expect(internalResult.items.some((item) => item.id === created.id)).toBe(true)
    })
  })
})
