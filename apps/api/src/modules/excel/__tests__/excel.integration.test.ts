import { schema } from '@mr/db'
import { AuditAction, ClaimOutcome, ExcelExportScope, normalizeName } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  ensureTestUser,
  getClaimSourceIdByCode,
  getEmployeeIdByNormalizedName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { createTestEngineType } from '../../../test-helpers/engine-type-fixtures.js'
import { buildTestContainer, createExcelTestApp, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const EXPORT_OPERATOR = testUser([
  'emotive_claims.view',
  'emotive_claims.create',
  'domace_claims.view',
  'domace_claims.create',
  'export.workbook_partial',
])

const EXPORT_FULL = testUser([
  'emotive_claims.view',
  'emotive_claims.create',
  'domace_claims.view',
  'domace_claims.create',
  'export.workbook_partial',
  'export.workbook_full',
])

const NO_EXPORT = testUser(['emotive_claims.view', 'domace_claims.view'])

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

describe('Excel export integration', () => {
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

  async function createEmotiveClaim(mrNumber: string): Promise<void> {
    const engineType = await createTestEngineType(container, `EX-${Date.now()}-${mrNumber}`)

    await container.emotiveClaimsService.create(
      {
        engineTypeId: engineType.id,
        dateOfClaim: new Date('2025-03-15T12:00:00.000Z'),
        mrNumber,
        outcome: ClaimOutcome.Accepted,
        warrantyReport: 'Excel export test',
        employeeId: await getEmployeeIdByNormalizedName(ctx.db, normalizeName('Dejan Milovanović')),
        sourceId: await getClaimSourceIdByCode(ctx.db, 'SELMAN'),
        faults: [],
        findings: [],
      },
      {
        id: TEST_USER_ID,
        permissions: ['emotive_claims.view', 'emotive_claims.create', 'domace_claims.view'],
      },
      auditContext,
    )
  }

  async function createDomaceClaim(mrNumber: string): Promise<void> {
    await container.domaceClaimsService.create(
      {
        mrNumber,
        customerName: 'Excel Domace',
        dateOfClaim: new Date('2025-02-10T12:00:00.000Z'),
        outcome: ClaimOutcome.Accepted,
        totalAmount: 120000,
        faults: [],
        findings: [],
      },
      {
        id: TEST_USER_ID,
        permissions: ['domace_claims.view', 'domace_claims.create', 'emotive_claims.view'],
      },
      auditContext,
    )
  }

  it('returns 403 without export permission', async () => {
    const app = createExcelTestApp(container, NO_EXPORT)

    const response = await app.request('/api/excel/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: ExcelExportScope.Emotive }),
    })

    expect(response.status).toBe(403)
  })

  it('returns 403 for full export without export.workbook_full', async () => {
    const app = createExcelTestApp(container, EXPORT_OPERATOR)
    await createEmotiveClaim('1001/25')

    const response = await app.request('/api/excel/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: ExcelExportScope.All }),
    })

    expect(response.status).toBe(403)
  })

  it('exports xlsx workbook with emotive and domace sheets', async () => {
    const app = createExcelTestApp(container, EXPORT_FULL)
    await createEmotiveClaim('2001/25')
    await createDomaceClaim('3001/25')

    const response = await app.request('/api/excel/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: ExcelExportScope.All }),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    expect(response.headers.get('Content-Disposition')).toContain('reklamacije-')

    const buffer = Buffer.from(await response.arrayBuffer())
    expect(buffer.byteLength).toBeGreaterThan(100)
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK')

    const auditRows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityType, 'excel_workbook'))

    expect(auditRows.some((row) => row.action === AuditAction.Export)).toBe(true)
  })

  it('exports only emotive rows when scope is emotive', async () => {
    const app = createExcelTestApp(container, EXPORT_OPERATOR)
    await createEmotiveClaim('4001/25')
    await createDomaceClaim('5001/25')

    const response = await app.request('/api/excel/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: ExcelExportScope.Emotive, claimYear: 2025 }),
    })

    expect(response.status).toBe(200)
    const buffer = Buffer.from(await response.arrayBuffer())
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK')
  })
})
