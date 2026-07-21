import { schema } from '@mr/db'
import {
  AuditAction,
  ClaimOutcome,
  ERROR_CODE,
  normalizeName,
  SYSTEM_ROLE_CLIENT,
} from '@mr/shared'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getCustomerIdByName,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { createTestEngineType } from '../../../test-helpers/engine-type-fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import {
  buildTestContainer,
  createEmotiveClaimsTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import type { Container } from '../../../core/container.js'
import type { EmotiveClaimCreateInput } from '../emotive-claims.validators.js'

const FULL_OPERATOR_PERMS = [
  'emotive_claims.view',
  'emotive_claims.create',
  'emotive_claims.update',
  'emotive_claims.delete',
  'emotive_claims.change_outcome',
] as const

function serializeCreateBody(input: EmotiveClaimCreateInput): Record<string, unknown> {
  return {
    warrantyReport: input.warrantyReport,
    engineTypeId: input.engineTypeId,
    engineCode: input.engineCode,
    dateOfClaim: input.dateOfClaim.toISOString().slice(0, 10),
    mrNumber: input.mrNumber,
    employeeId: input.employeeId,
    sourceId: input.sourceId,
    outcome: input.outcome,
    claimNumber: input.claimNumber,
    dateOfFinish: input.dateOfFinish?.toISOString().slice(0, 10),
    customerId: input.customerId,
    internalNotes: input.internalNotes,
    faults: input.faults,
  }
}

describe('EmotiveClaims HTTP', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    await ensureTestUser(ctx.db)
  })

  afterEach(async () => {
    await ctx.cleanup()
  })

  async function createEngineType(): Promise<string> {
    const code = `ENG-${crypto.randomUUID().slice(0, 8)}`
    const created = await createTestEngineType(container, code)
    return created.id
  }

  async function buildCreateInput(
    overrides: Partial<EmotiveClaimCreateInput> = {},
  ): Promise<EmotiveClaimCreateInput> {
    const engineTypeId = overrides.engineTypeId ?? (await createEngineType())
    const employeeId =
      'employeeId' in overrides
        ? overrides.employeeId
        : await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović'))
    const sourceId =
      'sourceId' in overrides ? overrides.sourceId : await getClaimSourceIdByCode(ctx.db, 'SELMAN')
    const warrantyReport =
      'warrantyReport' in overrides ? overrides.warrantyReport : 'Kvar na motoru pri hladnom startu'

    return {
      engineTypeId,
      dateOfClaim: new Date('2026-04-17'),
      mrNumber: `HTTP-${Date.now()}/26`,
      employeeId,
      sourceId,
      warrantyReport,
      outcome: ClaimOutcome.Pending,
      faults: [],
      findings: [],
      ...overrides,
    }
  }

  async function createClaimViaHttp(overrides: Partial<EmotiveClaimCreateInput> = {}): Promise<{
    id: string
    customerId: string | null
    sourceId: string
    internalNotes: string | null
  }> {
    const app = createEmotiveClaimsTestApp(container, testUser([...FULL_OPERATOR_PERMS]))
    const input = await buildCreateInput(overrides)
    const res = await app.request('/api/emotive-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serializeCreateBody(input)),
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as {
      id: string
      customerId: string | null
      sourceId: string
      internalNotes: string | null
    }
    return body
  }

  describe('GET /api/emotive-claims', () => {
    it('returns 401 without auth', async () => {
      const app = createEmotiveClaimsTestApp(container, null)
      const res = await app.request('/api/emotive-claims')
      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Unauthorized)
    })

    it('returns 403 without view permission', async () => {
      const app = createEmotiveClaimsTestApp(container, testUser(['customers.view']))
      const res = await app.request('/api/emotive-claims')
      expect(res.status).toBe(403)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.Forbidden)
    })

    it('returns 200 for emotive_claims.view', async () => {
      await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request('/api/emotive-claims?page=1&pageSize=10')
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        items: Array<{
          kind: string
          customerName: string | null
          engineTypeCode: string
          employeeName: string
        }>
        total: number
        page: number
        pageSize: number
      }
      expect(body.items.length).toBeGreaterThan(0)
      expect(body.total).toBeGreaterThan(0)
      expect(body.page).toBe(1)
      expect(body.pageSize).toBe(10)
      expect(body.items[0]?.kind).toBe('emotive')
      expect(body.items[0]?.engineTypeCode).toBeTruthy()
      expect(body.items[0]?.employeeName).toBeTruthy()
    })

    it('limits rows to linked customers for view_own_customer', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      const customerVitobello = await getCustomerIdByName(ctx.db, 'VITOBELLO')

      await ctx.db
        .insert(schema.customerUsers)
        .values({
          customerId: customerSelman,
          userId: TEST_USER_ID,
          assignedBy: TEST_USER_ID,
        })
        .onConflictDoNothing()

      const visible = await createClaimViaHttp({
        customerId: customerSelman,
        mrNumber: 'HTTP-OWN-1/26',
        warrantyReport: 'view-own-customer http list filter',
      })
      expect(visible.customerId).toBe(customerSelman)

      await createClaimViaHttp({
        customerId: customerVitobello,
        mrNumber: 'HTTP-OWN-2/26',
      })

      const app = createEmotiveClaimsTestApp(
        container,
        testUser(['emotive_claims.view_own_customer']),
      )
      const res = await app.request(
        `/api/emotive-claims?page=1&pageSize=50&customerId=${customerSelman}&sourceId=${visible.sourceId}&search=view-own-customer&dateFrom=2026-04-17&dateTo=2026-04-17`,
      )
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: Array<Record<string, unknown>> }
      // The own claim is visible to the linked scoped viewer...
      expect(body.items.some((item) => item['id'] === visible.id)).toBe(true)
      // ...and the list is whitelisted — internal `customerId` is stripped
      // (breadth now follows the scope permission, not the role name).
      expect(body.items.every((item) => !('customerId' in item))).toBe(true)
    })

    it('client list items are whitelisted — no handler (employeeName/employeeId)', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()

      await createClaimViaHttp({
        customerId: customerSelman,
        mrNumber: 'HTTP-CLIENT-LIST/26',
        warrantyReport: 'client-list-wl',
      })

      const app = createEmotiveClaimsTestApp(
        container,
        testUser(['emotive_claims.view_own_customer'], TEST_USER_ID, [SYSTEM_ROLE_CLIENT]),
      )
      const res = await app.request(
        `/api/emotive-claims?page=1&pageSize=50&customerId=${customerSelman}&search=client-list-wl`,
      )
      expect(res.status).toBe(200)

      const body = (await res.json()) as { items: Array<Record<string, unknown>> }
      expect(body.items.length).toBeGreaterThan(0)
      for (const item of body.items) {
        for (const key of ['employeeName', 'employeeId', 'sourceId', 'customerId']) {
          expect(key in item).toBe(false)
        }
        expect(item['kind']).toBe('emotive')
        expect(item['outcome']).toBeTruthy()
      }
    })
  })

  describe('GET /api/emotive-claims/:id', () => {
    it('returns 401 without auth', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, null)
      const res = await app.request(`/api/emotive-claims/${created.id}`)
      expect(res.status).toBe(401)
    })

    it('returns 403 without view permission', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.create']))
      const res = await app.request(`/api/emotive-claims/${created.id}`)
      expect(res.status).toBe(403)
    })

    it('returns internalNotes for operator', async () => {
      const created = await createClaimViaHttp({ internalNotes: 'Interna napomena za operatera' })
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request(`/api/emotive-claims/${created.id}`)
      expect(res.status).toBe(200)

      const body = (await res.json()) as { internalNotes: string | null }
      expect(body.internalNotes).toBe('Interna napomena za operatera')
    })

    it('client detail is a strict whitelist — no faults (krivica), handler, or internal notes', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      await ctx.db
        .insert(schema.customerUsers)
        .values({
          customerId: customerSelman,
          userId: TEST_USER_ID,
          assignedBy: TEST_USER_ID,
        })
        .onConflictDoNothing()

      const dejanId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const created = await createClaimViaHttp({
        customerId: customerSelman,
        internalNotes: 'TAJNA INTERNA BELESKA',
        mrNumber: 'HTTP-CLIENT-WL/26',
        warrantyReport: 'client-detail-wl',
        faults: [{ faultType: 'employee', employeeId: dejanId, notes: 'TAJNA KRIVICA' }],
      })

      // Whitelist/masking is a separate concern from the Primljeno access gate
      // (0c6f552) — make the claim client-visible (but not yet published) so
      // the client can open it; outcome stays masked to pending below.
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date() })
        .where(eq(schema.emotiveClaims.id, created.id))

      const app = createEmotiveClaimsTestApp(
        container,
        testUser(['emotive_claims.view_own_customer'], TEST_USER_ID, [SYSTEM_ROLE_CLIENT]),
      )
      const res = await app.request(`/api/emotive-claims/${created.id}`)
      expect(res.status).toBe(200)

      const text = await res.text()
      const body = JSON.parse(text) as Record<string, unknown>

      // Internal keys must be ABSENT (whitelist, not blacklist).
      for (const key of [
        'faults',
        'employeeId',
        'internalNotes',
        'updatedBy',
        'updatedAt',
        'sourceId',
        'sourceCode',
        'customerId',
      ]) {
        expect(key in body).toBe(false)
      }

      // Client-safe fields present.
      expect(body['warrantyReport']).toBe('client-detail-wl')
      expect(body['outcome']).toBe(ClaimOutcome.Pending)
      expect(body['customerName']).toBeTruthy()
      expect(body['kind']).toBe('emotive')
      // Deliberate whitelist extension (approved 2026-07-03): the client may
      // see the assigned technician's NAME — never the employee id. Portal
      // status is derived from `outcome` (above), so no `progressPhase` ships.
      expect(body['employeeName']).toBe('Dejan Milovanović')
      expect('progressPhase' in body).toBe(false)

      // Raw secret strings never appear anywhere in the payload — including
      // the handler's employee id (the name is allowed, the id is not).
      expect(text).not.toContain('TAJNA KRIVICA')
      expect(text).not.toContain('TAJNA INTERNA BELESKA')
      expect(text).not.toContain(dejanId)
    })

    it('whitelist follows the SCOPE permission, not the role — a non-client role with only view_own_customer is still whitelisted', async () => {
      // Regression (2026-07-05 security audit): field breadth must be keyed on
      // the view PERMISSION, not the literal `client` role. A future custom
      // partner role granted only emotive_claims.view_own_customer must NOT
      // receive faults/employeeId/internalNotes/source.
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()

      const dejanId = await getEmployeeIdByNormalizedName(
        ctx.db,
        normalizeName('Dejan Milovanović'),
      )
      const created = await createClaimViaHttp({
        customerId: customerSelman,
        internalNotes: 'TAJNA INTERNA BELESKA',
        mrNumber: 'HTTP-PARTNER-WL/26',
        warrantyReport: 'partner-detail-wl',
        faults: [{ faultType: 'employee', employeeId: dejanId, notes: 'TAJNA KRIVICA' }],
      })

      // Make the claim client-visible so the access gate (0c6f552) lets the
      // scoped viewer open it — unrelated to the whitelist behavior asserted here.
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date() })
        .where(eq(schema.emotiveClaims.id, created.id))

      // NON-client role — the old role-keyed gate would have leaked full detail.
      const app = createEmotiveClaimsTestApp(
        container,
        testUser(['emotive_claims.view_own_customer'], TEST_USER_ID, ['partner_readonly']),
      )
      const res = await app.request(`/api/emotive-claims/${created.id}`)
      expect(res.status).toBe(200)

      const text = await res.text()
      const body = JSON.parse(text) as Record<string, unknown>

      for (const key of ['faults', 'employeeId', 'internalNotes', 'sourceId', 'customerId']) {
        expect(key in body).toBe(false)
      }
      expect(body['warrantyReport']).toBe('partner-detail-wl')
      expect(text).not.toContain('TAJNA KRIVICA')
      expect(text).not.toContain('TAJNA INTERNA BELESKA')
      expect(text).not.toContain(dejanId)
    })

    it('client gets 404 for another company’s claim (no cross-company leak)', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      const customerVitobello = await getCustomerIdByName(ctx.db, 'VITOBELLO')
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()

      // Claim belongs to VITOBELLO — NOT the client's linked company.
      const other = await createClaimViaHttp({
        customerId: customerVitobello,
        mrNumber: 'HTTP-OTHER-CO/26',
      })

      const app = createEmotiveClaimsTestApp(
        container,
        testUser(['emotive_claims.view_own_customer'], TEST_USER_ID, [SYSTEM_ROLE_CLIENT]),
      )
      const res = await app.request(`/api/emotive-claims/${other.id}`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/emotive-claims', () => {
    it('returns 401 without auth', async () => {
      const input = await buildCreateInput()
      const app = createEmotiveClaimsTestApp(container, null)
      const res = await app.request('/api/emotive-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeCreateBody(input)),
      })
      expect(res.status).toBe(401)
    })

    it('returns 403 without create permission', async () => {
      const input = await buildCreateInput()
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request('/api/emotive-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeCreateBody(input)),
      })
      expect(res.status).toBe(403)
    })

    it('returns 400 on invalid body', async () => {
      const app = createEmotiveClaimsTestApp(container, testUser([...FULL_OPERATOR_PERMS]))
      const res = await app.request('/api/emotive-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warrantyReport: 'bez ostalih polja' }),
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: { code: string } }
      expect(body.error.code).toBe(ERROR_CODE.ValidationError)
    })

    it('creates claim with 201 and response body', async () => {
      const input = await buildCreateInput({ mrNumber: 'HTTP-CREATE/26' })
      const app = createEmotiveClaimsTestApp(container, testUser([...FULL_OPERATOR_PERMS]))
      const res = await app.request('/api/emotive-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeCreateBody(input)),
      })

      expect(res.status).toBe(201)
      const body = (await res.json()) as { mrNumber: string; id: string }
      expect(body.mrNumber).toBe('HTTP-CREATE/26')
      expect(body.id.length).toBeGreaterThan(0)
    })
  })

  describe('PATCH /api/emotive-claims/:id', () => {
    it('returns 401 without auth', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, null)
      const res = await app.request(`/api/emotive-claims/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warrantyReport: 'Ažurirano' }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 403 without update permission', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request(`/api/emotive-claims/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warrantyReport: 'Ažurirano' }),
      })
      expect(res.status).toBe(403)
    })

    it('updates claim with 200', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, testUser([...FULL_OPERATOR_PERMS]))
      const res = await app.request(`/api/emotive-claims/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warrantyReport: 'Ažurirana garancija' }),
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as { warrantyReport: string }
      expect(body.warrantyReport).toBe('Ažurirana garancija')
    })
  })

  describe('DELETE /api/emotive-claims/:id', () => {
    it('returns 401 without auth', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, null)
      const res = await app.request(`/api/emotive-claims/${created.id}`, { method: 'DELETE' })
      expect(res.status).toBe(401)
    })

    it('returns 403 without delete permission', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request(`/api/emotive-claims/${created.id}`, { method: 'DELETE' })
      expect(res.status).toBe(403)
    })

    it('soft-deletes claim and excludes it from list', async () => {
      const created = await createClaimViaHttp({ mrNumber: 'HTTP-DEL/26' })
      const app = createEmotiveClaimsTestApp(container, testUser([...FULL_OPERATOR_PERMS]))

      const deleteRes = await app.request(`/api/emotive-claims/${created.id}`, { method: 'DELETE' })
      expect(deleteRes.status).toBe(204)

      const listRes = await app.request('/api/emotive-claims?page=1&pageSize=50')
      expect(listRes.status).toBe(200)
      const listBody = (await listRes.json()) as { items: Array<{ id: string }> }
      expect(listBody.items.some((item) => item.id === created.id)).toBe(false)
    })
  })

  describe('POST /api/emotive-claims/:id/change-outcome', () => {
    it('returns 401 without auth', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, null)
      const res = await app.request(`/api/emotive-claims/${created.id}/change-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: ClaimOutcome.Accepted }),
      })
      expect(res.status).toBe(401)
    })

    it('returns 403 without change_outcome permission', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request(`/api/emotive-claims/${created.id}/change-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: ClaimOutcome.Accepted }),
      })
      expect(res.status).toBe(403)
    })

    it('changes outcome with 200 and writes audit log', async () => {
      const created = await createClaimViaHttp({ mrNumber: 'HTTP-OUTCOME/26' })
      const app = createEmotiveClaimsTestApp(container, testUser([...FULL_OPERATOR_PERMS]))
      const res = await app.request(`/api/emotive-claims/${created.id}/change-outcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: ClaimOutcome.Accepted }),
      })

      expect(res.status).toBe(200)
      const body = (await res.json()) as { outcome: string }
      expect(body.outcome).toBe(ClaimOutcome.Accepted)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.entityId, created.id),
            eq(schema.auditLog.action, AuditAction.Update),
          ),
        )
      expect(auditRows.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('POST /api/emotive-claims/:id/publish', () => {
    it('returns 401 without auth', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, null)
      const res = await app.request(`/api/emotive-claims/${created.id}/publish`, {
        method: 'POST',
      })
      expect(res.status).toBe(401)
    })

    it('returns 403 without publish permission', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.view']))
      const res = await app.request(`/api/emotive-claims/${created.id}/publish`, {
        method: 'POST',
      })
      expect(res.status).toBe(403)
    })

    it('publishes with 200, writes audit log, and reveals the real outcome to the client (was masked before)', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()

      const created = await createClaimViaHttp({
        customerId: customerSelman,
        mrNumber: 'HTTP-PUBLISH/26',
        outcome: ClaimOutcome.Accepted,
      })

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date() })
        .where(eq(schema.emotiveClaims.id, created.id))

      const clientApp = createEmotiveClaimsTestApp(
        container,
        testUser(['emotive_claims.view_own_customer'], TEST_USER_ID, [SYSTEM_ROLE_CLIENT]),
      )
      const beforeRes = await clientApp.request(`/api/emotive-claims/${created.id}`)
      expect(beforeRes.status).toBe(200)
      const beforeBody = (await beforeRes.json()) as { outcome: string }
      // Masked while unpublished — the client sees pending regardless of the real outcome.
      expect(beforeBody.outcome).toBe(ClaimOutcome.Pending)

      const operatorApp = createEmotiveClaimsTestApp(
        container,
        testUser([...FULL_OPERATOR_PERMS, 'emotive_claims.publish']),
      )
      const publishRes = await operatorApp.request(`/api/emotive-claims/${created.id}/publish`, {
        method: 'POST',
      })
      expect(publishRes.status).toBe(200)
      const publishBody = (await publishRes.json()) as {
        publishedAt: string | null
        outcome: string
      }
      expect(publishBody.publishedAt).not.toBeNull()
      expect(publishBody.outcome).toBe(ClaimOutcome.Accepted)

      const auditRows = await ctx.db
        .select()
        .from(schema.auditLog)
        .where(
          and(
            eq(schema.auditLog.entityId, created.id),
            eq(schema.auditLog.action, AuditAction.Update),
          ),
        )
      expect(
        auditRows.some(
          (row) => (row.changes as { transition?: string } | null)?.transition === 'publish',
        ),
      ).toBe(true)

      const afterRes = await clientApp.request(`/api/emotive-claims/${created.id}`)
      expect(afterRes.status).toBe(200)
      const afterBody = (await afterRes.json()) as { outcome: string }
      // Published — the real outcome is now revealed.
      expect(afterBody.outcome).toBe(ClaimOutcome.Accepted)
    })

    it('is idempotent: republishing returns 200 with the same published_at and no duplicate audit row', async () => {
      const created = await createClaimViaHttp({ mrNumber: 'HTTP-PUBLISH-IDEMPOTENT/26' })
      const app = createEmotiveClaimsTestApp(
        container,
        testUser([...FULL_OPERATOR_PERMS, 'emotive_claims.publish']),
      )

      const firstRes = await app.request(`/api/emotive-claims/${created.id}/publish`, {
        method: 'POST',
      })
      expect(firstRes.status).toBe(200)
      const firstBody = (await firstRes.json()) as { publishedAt: string | null }
      expect(firstBody.publishedAt).not.toBeNull()

      const auditCountBefore = (
        await ctx.db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, created.id))
      ).length

      const secondRes = await app.request(`/api/emotive-claims/${created.id}/publish`, {
        method: 'POST',
      })
      expect(secondRes.status).toBe(200)
      const secondBody = (await secondRes.json()) as { publishedAt: string | null }
      expect(secondBody.publishedAt).toBe(firstBody.publishedAt)

      const auditCountAfter = (
        await ctx.db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, created.id))
      ).length
      expect(auditCountAfter).toBe(auditCountBefore)
    })
  })

  describe('POST /api/emotive-claims/:id/mark-seen', () => {
    it('returns 401 without auth', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, null)
      const res = await app.request(`/api/emotive-claims/${created.id}/mark-seen`, {
        method: 'POST',
      })
      expect(res.status).toBe(401)
    })

    it('returns 403 for an actor lacking the view permission', async () => {
      const created = await createClaimViaHttp()
      const app = createEmotiveClaimsTestApp(container, testUser(['emotive_claims.create']))
      const res = await app.request(`/api/emotive-claims/${created.id}/mark-seen`, {
        method: 'POST',
      })
      expect(res.status).toBe(403)
    })

    it('returns 204 for a client on an openable owned claim and records the view', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()

      const created = await createClaimViaHttp({
        customerId: customerSelman,
        mrNumber: 'HTTP-MARKSEEN-OK/26',
      })
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date() })
        .where(eq(schema.emotiveClaims.id, created.id))

      const app = createEmotiveClaimsTestApp(
        container,
        testUser(['emotive_claims.view_own_customer'], TEST_USER_ID, [SYSTEM_ROLE_CLIENT]),
      )
      const res = await app.request(`/api/emotive-claims/${created.id}/mark-seen`, {
        method: 'POST',
      })
      expect(res.status).toBe(204)

      const [view] = await ctx.db
        .select({ viewedAt: schema.emotiveClaimClientViews.viewedAt })
        .from(schema.emotiveClaimClientViews)
        .where(
          and(
            eq(schema.emotiveClaimClientViews.emotiveClaimId, created.id),
            eq(schema.emotiveClaimClientViews.userId, TEST_USER_ID),
          ),
        )
      expect(view?.viewedAt).toBeTruthy()
    })

    it('returns 404 for an inaccessible claim (another company’s, no cross-company leak)', async () => {
      const customerSelman = await getCustomerIdByName(ctx.db, 'SELMAN')
      const customerVitobello = await getCustomerIdByName(ctx.db, 'VITOBELLO')
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId: customerSelman, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing()

      const other = await createClaimViaHttp({
        customerId: customerVitobello,
        mrNumber: 'HTTP-MARKSEEN-OTHER-CO/26',
      })
      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date() })
        .where(eq(schema.emotiveClaims.id, other.id))

      const app = createEmotiveClaimsTestApp(
        container,
        testUser(['emotive_claims.view_own_customer'], TEST_USER_ID, [SYSTEM_ROLE_CLIENT]),
      )
      const res = await app.request(`/api/emotive-claims/${other.id}/mark-seen`, {
        method: 'POST',
      })
      expect(res.status).toBe(404)
    })
  })
})
