import { mkdir, rm } from 'node:fs/promises'

import { schema } from '@mr/db'
import { AttachmentVisibility, AuditAction, ClaimKind, ClaimOutcome, ERROR_CODE } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  ConflictError,
  ForbiddenError,
  UnsupportedMediaTypeError,
} from '../../../core/errors/domain-errors.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import {
  buildTestContainer,
  createAttachmentsTestApp,
  testUser,
} from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'

const ATTACHMENT_OPERATOR = testUser([
  'domace_claims.view',
  'domace_claims.create',
  'attachments.view_internal',
  'attachments.upload',
  'attachments.delete_own',
])

const ATTACHMENT_VIEWER = testUser(['domace_claims.view', 'attachments.view_internal'])

const auditContext = {
  actorUserId: TEST_USER_ID,
  actorIp: null,
  actorUserAgent: null,
}

const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

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

describe('AttachmentsService integration', () => {
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

  it('uploads a jpeg, lists it, and writes audit log', async () => {
    const claimId = await createDomaceClaim(container)

    const result = await container.attachmentsService.upload(
      {
        claimKind: ClaimKind.Domace,
        claimId,
        visibility: AttachmentVisibility.Internal,
        files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
      },
      { id: TEST_USER_ID, permissions: ['attachments.upload', 'domace_claims.view'] },
      auditContext,
    )

    expect(result.items).toHaveLength(1)
    expect(result.skippedDuplicates).toBe(0)
    expect(result.items[0]?.mimeType).toBe('image/jpeg')
    expect(result.items[0]?.fileName).toBe('engine.jpg')

    const list = await container.attachmentsService.list(
      { claimKind: ClaimKind.Domace, claimId },
      { id: TEST_USER_ID, permissions: ['attachments.view_internal', 'domace_claims.view'] },
    )
    expect(list.items).toHaveLength(1)

    const auditRows = await ctx.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.entityType, 'attachment'))

    expect(auditRows.some((row) => row.action === AuditAction.Create)).toBe(true)

    const raw = await container.attachmentsRepository.findRawById(result.items[0]?.id ?? '')
    expect(raw).not.toBeNull()
    expect(await container.storageService.exists(raw?.storagePath ?? '')).toBe(true)
  })

  it('client scope sees claim PHOTOS regardless of visibility, but never documents', async () => {
    const claimId = await createDomaceClaim(container)
    const uploader = { id: TEST_USER_ID, permissions: ['attachments.upload', 'domace_claims.view'] }

    // Operator uploads both as plain internal — no toggle involved.
    await container.attachmentsService.upload(
      {
        claimKind: ClaimKind.Domace,
        claimId,
        visibility: AttachmentVisibility.Internal,
        files: [
          { fileName: 'engine.jpg', data: MINIMAL_JPEG },
          { fileName: 'report.pdf', data: Buffer.from('%PDF-1.4\n% regression fixture') },
        ],
      },
      uploader,
      auditContext,
    )

    const clientList = await container.attachmentsService.list(
      { claimKind: ClaimKind.Domace, claimId },
      { id: TEST_USER_ID, permissions: ['attachments.view_client_visible', 'domace_claims.view'] },
    )

    // Images are always client-visible by rule (2026-07-04); documents are not.
    expect(clientList.items).toHaveLength(1)
    expect(clientList.items[0]?.mimeType).toBe('image/jpeg')

    const internalList = await container.attachmentsService.list(
      { claimKind: ClaimKind.Domace, claimId },
      { id: TEST_USER_ID, permissions: ['attachments.view_internal', 'domace_claims.view'] },
    )
    expect(internalList.items).toHaveLength(2)
  })

  it('skips duplicate uploads with the same sha256 on the same claim', async () => {
    const claimId = await createDomaceClaim(container)
    const actor = { id: TEST_USER_ID, permissions: ['attachments.upload', 'domace_claims.view'] }
    const input = {
      claimKind: ClaimKind.Domace,
      claimId,
      visibility: AttachmentVisibility.Internal,
      files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
    }

    const first = await container.attachmentsService.upload(input, actor, auditContext)
    const second = await container.attachmentsService.upload(input, actor, auditContext)

    expect(first.items).toHaveLength(1)
    expect(second.items).toHaveLength(1)
    expect(second.skippedDuplicates).toBe(1)
    expect(first.items[0]?.id).toBe(second.items[0]?.id)
  })

  it('rejects unsupported file types after magic-byte validation', async () => {
    const claimId = await createDomaceClaim(container)

    await expect(
      container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Domace,
          claimId,
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'notes.txt', data: Buffer.from('plain text') }],
        },
        { id: TEST_USER_ID, permissions: ['attachments.upload', 'domace_claims.view'] },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeError)
  })

  it('throws ForbiddenError without upload permission', async () => {
    const claimId = await createDomaceClaim(container)

    await expect(
      container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Domace,
          claimId,
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        },
        { id: TEST_USER_ID, permissions: ['domace_claims.view'] },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('blocks upload when the parent claim is locked', async () => {
    const claimId = await createDomaceClaim(container)
    await container.domaceClaimsService.changeOutcome(
      claimId,
      { outcome: ClaimOutcome.Accepted },
      { id: TEST_USER_ID, permissions: ['domace_claims.view', 'domace_claims.change_outcome'] },
      auditContext,
    )

    await expect(
      container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Domace,
          claimId,
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        },
        { id: TEST_USER_ID, permissions: ['attachments.upload', 'domace_claims.view'] },
        auditContext,
      ),
    ).rejects.toBeInstanceOf(ConflictError)
  })

  it('soft-deletes an attachment and hides it from list', async () => {
    const claimId = await createDomaceClaim(container)
    const actor = {
      id: TEST_USER_ID,
      permissions: [
        'attachments.upload',
        'attachments.view_internal',
        'attachments.delete_own',
        'domace_claims.view',
      ],
    }

    const uploaded = await container.attachmentsService.upload(
      {
        claimKind: ClaimKind.Domace,
        claimId,
        visibility: AttachmentVisibility.Internal,
        files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
      },
      actor,
      auditContext,
    )

    const attachmentId = uploaded.items[0]?.id
    expect(attachmentId).toBeDefined()

    await container.attachmentsService.delete(attachmentId!, actor, auditContext)

    const list = await container.attachmentsService.list(
      { claimKind: ClaimKind.Domace, claimId },
      actor,
    )
    expect(list.items).toHaveLength(0)
  })
})

describe('Attachments HTTP integration', () => {
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

  it('returns a signed URL that downloads the attachment without session auth', async () => {
    const app = createAttachmentsTestApp(container, ATTACHMENT_OPERATOR)
    const claimId = await createDomaceClaim(container)

    const formData = new FormData()
    formData.set('claimKind', ClaimKind.Domace)
    formData.set('claimId', claimId)
    formData.set('visibility', AttachmentVisibility.Internal)
    formData.set('files', new File([MINIMAL_JPEG], 'engine.jpg', { type: 'image/jpeg' }))

    const uploadResponse = await app.request('/api/attachments/upload', {
      method: 'POST',
      body: formData,
    })
    expect(uploadResponse.status).toBe(201)

    const uploadBody = (await uploadResponse.json()) as { items: Array<{ id: string }> }
    const attachmentId = uploadBody.items[0]?.id
    expect(attachmentId).toBeDefined()

    const signedResponse = await app.request(`/api/attachments/${attachmentId}/signed-url`, {
      method: 'GET',
    })
    expect(signedResponse.status).toBe(200)

    const signedBody = (await signedResponse.json()) as { url: string }
    const rawUrl = new URL(signedBody.url)
    const rawResponse = await app.request(`${rawUrl.pathname}${rawUrl.search}`)
    expect(rawResponse.status).toBe(200)
    expect(rawResponse.headers.get('content-type')).toBe('image/jpeg')
  })

  it('caches inline documents (not just images) with an ETag and revalidates via 304', async () => {
    const app = createAttachmentsTestApp(container, ATTACHMENT_OPERATOR)
    const claimId = await createDomaceClaim(container)

    const formData = new FormData()
    formData.set('claimKind', ClaimKind.Domace)
    formData.set('claimId', claimId)
    formData.set('visibility', AttachmentVisibility.Internal)
    formData.set(
      'files',
      new File([Buffer.from('%PDF-1.4\n% cache regression')], 'report.pdf', {
        type: 'application/pdf',
      }),
    )

    const uploadResponse = await app.request('/api/attachments/upload', {
      method: 'POST',
      body: formData,
    })
    expect(uploadResponse.status).toBe(201)
    const uploadBody = (await uploadResponse.json()) as { items: Array<{ id: string }> }
    const attachmentId = uploadBody.items[0]?.id
    expect(attachmentId).toBeDefined()

    const downloadResponse = await app.request(`/api/attachments/${attachmentId}/download`)
    expect(downloadResponse.status).toBe(200)
    expect(downloadResponse.headers.get('content-type')).toBe('application/pdf')
    expect(downloadResponse.headers.get('cache-control')).toBe('private, max-age=86400')
    const etag = downloadResponse.headers.get('etag')
    expect(etag).not.toBeNull()

    const revalidateResponse = await app.request(`/api/attachments/${attachmentId}/download`, {
      headers: { 'if-none-match': etag as string },
    })
    expect(revalidateResponse.status).toBe(304)
    expect(revalidateResponse.headers.get('etag')).toBe(etag)
  })

  it('returns 403 when listing attachments without view permission', async () => {
    const app = createAttachmentsTestApp(container, testUser(['domace_claims.view']))
    const claimId = await createDomaceClaim(container)

    const response = await app.request(
      `/api/attachments?claimKind=${ClaimKind.Domace}&claimId=${claimId}`,
    )

    expect(response.status).toBe(403)
    const body = (await response.json()) as { error: { code: string } }
    expect(body.error.code).toBe(ERROR_CODE.Forbidden)
  })

  it('returns 403 for viewer without upload permission on upload route', async () => {
    const app = createAttachmentsTestApp(container, ATTACHMENT_VIEWER)
    const claimId = await createDomaceClaim(container)

    const formData = new FormData()
    formData.set('claimKind', ClaimKind.Domace)
    formData.set('claimId', claimId)
    formData.set('files', new File([MINIMAL_JPEG], 'engine.jpg', { type: 'image/jpeg' }))

    const response = await app.request('/api/attachments/upload', {
      method: 'POST',
      body: formData,
    })

    expect(response.status).toBe(403)
  })
})
