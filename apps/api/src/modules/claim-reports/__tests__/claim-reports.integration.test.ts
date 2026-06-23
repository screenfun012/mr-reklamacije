import { mkdir, rm } from 'node:fs/promises'

import { schema } from '@mr/db'
import {
  AuditAction,
  ClaimKind,
  ClaimOutcome,
  DEFAULT_CLAIM_REPORT_CONTENT_HTML,
  DEFAULT_CLAIM_REPORT_CONTENT_JSON,
  ERROR_CODE,
  MAX_REPORT_IMAGE_WIDTH,
} from '@mr/shared'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import { ConflictError, ForbiddenError } from '../../../core/errors/domain-errors.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import {
  buildTestContainer,
  createClaimReportsTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const REPORT_OPERATOR = testUser([
  'domace_claims.view',
  'domace_claims.create',
  'domace_claims.change_outcome',
  'claim_reports.view',
  'claim_reports.update',
])

const REPORT_VIEWER = testUser(['domace_claims.view', 'claim_reports.view'])

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

const SAMPLE_BODY = {
  contentJson: {
    type: 'doc' as const,
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test izveštaj' }] }],
  },
  contentHtml: '<p>Test izveštaj</p>',
}

const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

async function createTestJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 120, b: 60 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
}

async function createDomaceClaim(container: Container): Promise<string> {
  const created = await container.domaceClaimsService.create(
    {
      customerName: 'Auto Stanić',
      outcome: ClaimOutcome.Pending,
      faults: [],
    },
    { id: TEST_USER_ID, permissions: ['domace_claims.view', 'domace_claims.create'] },
    auditContext,
  )

  return created.id
}

describe('ClaimReportsService integration', () => {
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

  it('returns default empty doc when no report exists', async () => {
    const claimId = await createDomaceClaim(container)

    const result = await container.claimReportsService.get(
      { claimKind: ClaimKind.Domace, claimId },
      { id: TEST_USER_ID, permissions: ['claim_reports.view', 'domace_claims.view'] },
    )

    expect(result.persisted).toBe(false)
    expect(result.id).toBeNull()
    expect(result.contentJson).toEqual(DEFAULT_CLAIM_REPORT_CONTENT_JSON)
    expect(result.contentHtml).toBe(DEFAULT_CLAIM_REPORT_CONTENT_HTML)
  })

  it('creates a report on first upsert and writes audit create', async () => {
    const claimId = await createDomaceClaim(container)
    const actor = {
      id: TEST_USER_ID,
      permissions: ['claim_reports.view', 'claim_reports.update', 'domace_claims.view'],
    }

    const saved = await container.claimReportsService.upsert(
      { claimKind: ClaimKind.Domace, claimId },
      SAMPLE_BODY,
      actor,
      auditContext,
    )

    expect(saved.persisted).toBe(true)
    expect(saved.id).toBeDefined()
    expect(saved.contentHtml).toBe(SAMPLE_BODY.contentHtml)

    const auditRows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityType, 'claim_report'))

    expect(auditRows.some((row) => row.action === AuditAction.Create)).toBe(true)
  })

  it('updates existing report on second upsert and writes audit update', async () => {
    const claimId = await createDomaceClaim(container)
    const actor = {
      id: TEST_USER_ID,
      permissions: ['claim_reports.view', 'claim_reports.update', 'domace_claims.view'],
    }
    const query = { claimKind: ClaimKind.Domace, claimId }

    const first = await container.claimReportsService.upsert(
      query,
      SAMPLE_BODY,
      actor,
      auditContext,
    )
    const updatedBody = {
      ...SAMPLE_BODY,
      contentHtml: '<p>Ažurirano</p>',
    }
    const second = await container.claimReportsService.upsert(
      query,
      updatedBody,
      actor,
      auditContext,
    )

    expect(second.id).toBe(first.id)
    expect(second.contentHtml).toBe('<p>Ažurirano</p>')

    const rows = await ctx.db
      .select()
      .from(schema.claimReports)
      .where(eq(schema.claimReports.domaceClaimId, claimId))

    expect(rows).toHaveLength(1)

    const auditRows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityType, 'claim_report'))

    expect(auditRows.some((row) => row.action === AuditAction.Update)).toBe(true)
  })

  it('throws ForbiddenError without claim_reports.view', async () => {
    const claimId = await createDomaceClaim(container)

    await expect(
      container.claimReportsService.get(
        { claimKind: ClaimKind.Domace, claimId },
        { id: TEST_USER_ID, permissions: ['domace_claims.view'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('throws ForbiddenError without claim_reports.update', async () => {
    const claimId = await createDomaceClaim(container)

    await expect(
      container.claimReportsService.upsert(
        { claimKind: ClaimKind.Domace, claimId },
        SAMPLE_BODY,
        { id: TEST_USER_ID, permissions: ['claim_reports.view', 'domace_claims.view'] },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('blocks upsert when the parent claim is locked', async () => {
    const claimId = await createDomaceClaim(container)
    await container.domaceClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Accepted },
      { id: TEST_USER_ID, permissions: ['domace_claims.view', 'domace_claims.change_outcome'] },
      auditContext,
    )

    await expect(
      container.claimReportsService.upsert(
        { claimKind: ClaimKind.Domace, claimId },
        SAMPLE_BODY,
        {
          id: TEST_USER_ID,
          permissions: ['claim_reports.view', 'claim_reports.update', 'domace_claims.view'],
        },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })
})

describe('ClaimReports HTTP integration', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl)
    await ensureTestUser(ctx.db)
    await mkdir(container.env.UPLOAD_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(container.env.UPLOAD_DIR, { recursive: true, force: true })
    await ctx.cleanup()
  })

  it('returns default doc on GET', async () => {
    const app = createClaimReportsTestApp(container, REPORT_OPERATOR)
    const claimId = await createDomaceClaim(container)

    const response = await app.request(
      `/api/claim-reports?claimKind=${ClaimKind.Domace}&claimId=${claimId}`,
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { persisted: boolean; contentHtml: string }
    expect(body.persisted).toBe(false)
    expect(body.contentHtml).toBe(DEFAULT_CLAIM_REPORT_CONTENT_HTML)
  })

  it('persists content on PUT', async () => {
    const app = createClaimReportsTestApp(container, REPORT_OPERATOR)
    const claimId = await createDomaceClaim(container)

    const response = await app.request(
      `/api/claim-reports?claimKind=${ClaimKind.Domace}&claimId=${claimId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SAMPLE_BODY),
      },
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as { persisted: boolean; contentHtml: string }
    expect(body.persisted).toBe(true)
    expect(body.contentHtml).toBe(SAMPLE_BODY.contentHtml)
  })

  it('returns 403 when listing without claim_reports.view', async () => {
    const app = createClaimReportsTestApp(container, testUser(['domace_claims.view']))
    const claimId = await createDomaceClaim(container)

    const response = await app.request(
      `/api/claim-reports?claimKind=${ClaimKind.Domace}&claimId=${claimId}`,
    )

    expect(response.status).toBe(403)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODE.Forbidden)
  })

  it('returns 403 for viewer without update permission on PUT', async () => {
    const app = createClaimReportsTestApp(container, REPORT_VIEWER)
    const claimId = await createDomaceClaim(container)

    const response = await app.request(
      `/api/claim-reports?claimKind=${ClaimKind.Domace}&claimId=${claimId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SAMPLE_BODY),
      },
    )

    expect(response.status).toBe(403)
  })

  it('uploads a report image and excludes it from attachment list', async () => {
    const app = createClaimReportsTestApp(
      container,
      testUser([
        'domace_claims.view',
        'domace_claims.create',
        'claim_reports.view',
        'claim_reports.update',
        'attachments.view_internal',
      ]),
    )
    const claimId = await createDomaceClaim(container)
    const reportImage = await createTestJpeg(640, 480)

    const formData = new FormData()
    formData.set('claimKind', ClaimKind.Domace)
    formData.set('claimId', claimId)
    formData.append('file', new Blob([reportImage], { type: 'image/jpeg' }), 'report.jpg')

    const uploadResponse = await app.request('/api/claim-reports/images', {
      method: 'POST',
      body: formData,
    })

    expect(uploadResponse.status).toBe(201)
    const uploadBody = (await uploadResponse.json()) as { id: string; url: string }
    expect(uploadBody.url).toBe(`/api/attachments/${uploadBody.id}/download`)

    const list = await container.attachmentsService.list(
      { claimKind: ClaimKind.Domace, claimId },
      {
        id: TEST_USER_ID,
        permissions: ['attachments.view_internal', 'domace_claims.view'],
      },
    )
    expect(list.items).toHaveLength(0)
  })

  it('returns 403 for report image upload without claim_reports.update', async () => {
    const app = createClaimReportsTestApp(container, REPORT_VIEWER)
    const claimId = await createDomaceClaim(container)

    const formData = new FormData()
    formData.set('claimKind', ClaimKind.Domace)
    formData.set('claimId', claimId)
    formData.append('file', new Blob([MINIMAL_JPEG], { type: 'image/jpeg' }), 'report.jpg')

    const response = await app.request('/api/claim-reports/images', {
      method: 'POST',
      body: formData,
    })

    expect(response.status).toBe(403)
  })

  it('stores optimized dimensions for large report image uploads', async () => {
    const app = createClaimReportsTestApp(
      container,
      testUser([
        'domace_claims.view',
        'domace_claims.create',
        'claim_reports.view',
        'claim_reports.update',
        'attachments.view_internal',
      ]),
    )
    const claimId = await createDomaceClaim(container)

    const largeImage = await createTestJpeg(3000, 2000)

    const formData = new FormData()
    formData.set('claimKind', ClaimKind.Domace)
    formData.set('claimId', claimId)
    formData.append('file', new Blob([largeImage], { type: 'image/jpeg' }), 'large-report.jpg')

    const uploadResponse = await app.request('/api/claim-reports/images', {
      method: 'POST',
      body: formData,
    })

    expect(uploadResponse.status).toBe(201)
    const uploadBody = (await uploadResponse.json()) as { id: string; url: string }

    const attachment = await container.attachmentsService.findById(uploadBody.id, {
      id: TEST_USER_ID,
      permissions: ['attachments.view_internal', 'domace_claims.view'],
    })

    expect(attachment.width).not.toBeNull()
    expect(attachment.width).toBeLessThanOrEqual(MAX_REPORT_IMAGE_WIDTH)
    expect(attachment.fileSizeBytes).toBeLessThan(largeImage.byteLength)
    expect(attachment.mimeType).toBe('image/jpeg')
  })

  it('strips script tags from saved report HTML on upsert', async () => {
    const claimId = await createDomaceClaim(container)
    const actor = {
      id: TEST_USER_ID,
      permissions: ['claim_reports.view', 'claim_reports.update', 'domace_claims.view'],
    }

    const saved = await container.claimReportsService.upsert(
      { claimKind: ClaimKind.Domace, claimId },
      {
        contentJson: SAMPLE_BODY.contentJson,
        contentHtml: '<p>Bezbedan tekst</p><script>alert(1)</script>',
      },
      actor,
      auditContext,
    )

    expect(saved.contentHtml).toBe('<p>Bezbedan tekst</p>')
    expect(saved.contentHtml).not.toContain('script')
  })
})
