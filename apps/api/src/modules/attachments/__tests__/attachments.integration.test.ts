import { mkdir, rm } from 'node:fs/promises'

import { schema } from '@mr/db'
import { AttachmentVisibility, AuditAction, ClaimKind, ClaimOutcome, ERROR_CODE } from '@mr/shared'
import { eq } from 'drizzle-orm'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Container } from '../../../core/container.js'
import {
  ForbiddenError,
  NotFoundError,
  UnsupportedMediaTypeError,
} from '../../../core/errors/domain-errors.js'
import { createTestEngineType } from '../../../test-helpers/engine-type-fixtures.js'
import {
  ensureTestUser,
  getClaimCategoryIdByCode,
  getCustomerIdByName,
  TEST_USER_ID,
} from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
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

async function createTestJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 180, g: 120, b: 60 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer()
}

async function createDomaceClaim(container: Container): Promise<string> {
  const created = await container.domaceClaimsService.create(
    {
      customerName: 'Auto Stanić',
      categoryId: await getClaimCategoryIdByCode(container.db, 'REMONT_MOTORA'),
      outcome: ClaimOutcome.Pending,
      faults: [],
      findings: [],
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

  /**
   * Publishing to the partner's portal is the one upload decision that leaves the firm, and until
   * 2026-08-17 it was an unchecked form field: `attachments.change_visibility` sat in the
   * permission catalog and nothing read it, so `attachments.upload` alone was enough.
   */
  it('refuses to mark a file client-visible without the permission that governs it', async () => {
    const claimId = await createDomaceClaim(container)
    const uploader = { id: TEST_USER_ID, permissions: ['attachments.upload', 'domace_claims.view'] }

    await expect(
      container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Domace,
          claimId,
          visibility: AttachmentVisibility.ClientVisible,
          files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        },
        uploader,
        auditContext,
      ),
    ).rejects.toThrow(ForbiddenError)

    // Refused outright, not quietly downgraded: nothing was stored under either visibility.
    const list = await container.attachmentsService.list(
      { claimKind: ClaimKind.Domace, claimId },
      { id: TEST_USER_ID, permissions: ['attachments.view_internal', 'domace_claims.view'] },
    )
    expect(list.items).toHaveLength(0)
  })

  it('accepts the same upload from someone who does hold it', async () => {
    const claimId = await createDomaceClaim(container)

    const result = await container.attachmentsService.upload(
      {
        claimKind: ClaimKind.Domace,
        claimId,
        visibility: AttachmentVisibility.ClientVisible,
        files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
      },
      {
        id: TEST_USER_ID,
        permissions: ['attachments.upload', 'attachments.change_visibility', 'domace_claims.view'],
      },
      auditContext,
    )

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.visibility).toBe(AttachmentVisibility.ClientVisible)
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

  describe('editing freedom (completed claims, no outcome lock)', () => {
    async function createAcceptedDomaceClaim(): Promise<string> {
      const claimId = await createDomaceClaim(container)
      await container.domaceClaimsService.changeOutcome(
        claimId,
        { outcome: ClaimOutcome.Accepted },
        { id: TEST_USER_ID, permissions: ['domace_claims.view', 'domace_claims.change_outcome'] },
        auditContext,
      )
      return claimId
    }

    it('lets an operator upload an attachment on a completed claim', async () => {
      const claimId = await createAcceptedDomaceClaim()

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
    })

    it('lets an operator upload a report image on a completed claim', async () => {
      const claimId = await createAcceptedDomaceClaim()
      const reportImage = await createTestJpeg(640, 480)

      const result = await container.attachmentsService.uploadReportImage(
        {
          claimKind: ClaimKind.Domace,
          claimId,
          file: { fileName: 'engine.jpg', data: reportImage },
        },
        { id: TEST_USER_ID, permissions: ['claim_reports.update', 'domace_claims.view'] },
        auditContext,
      )

      expect(result.id).toBeDefined()
    })

    it('lets an operator delete an attachment on a completed claim', async () => {
      const claimId = await createAcceptedDomaceClaim()
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

      await expect(
        container.attachmentsService.delete(attachmentId!, actor, auditContext),
      ).resolves.toBeUndefined()
    })
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

  describe('emotive client-visibility gate (Primljeno claims)', () => {
    const CLIENT_ACTOR = {
      id: TEST_USER_ID,
      permissions: ['emotive_claims.view_own_customer', 'attachments.view_client_visible'],
    }

    async function linkUserToCustomer(customerId: string): Promise<void> {
      await ctx.db
        .insert(schema.customerUsers)
        .values({ customerId, userId: TEST_USER_ID, assignedBy: TEST_USER_ID })
        .onConflictDoNothing({
          target: [schema.customerUsers.customerId, schema.customerUsers.userId],
        })
    }

    async function createEmotiveClaimForCustomer(customerId: string): Promise<string> {
      const engineType = await createTestEngineType(
        container,
        `ATT-EMO-${crypto.randomUUID().slice(0, 8)}`,
      )
      const created = await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          categoryId: await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA'),
          dateOfClaim: new Date('2026-04-17'),
          mrNumber: `ATT-${crypto.randomUUID().slice(0, 8)}/26`,
          outcome: ClaimOutcome.Pending,
          faults: [],
          findings: [],
          customerId,
        },
        { id: TEST_USER_ID, permissions: ['emotive_claims.view', 'emotive_claims.create'] },
        auditContext,
      )
      return created.id
    }

    it('404s a client listing attachments on a Primljeno (private) claim', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const claimId = await createEmotiveClaimForCustomer(customerId)

      await expect(
        container.attachmentsService.list({ claimKind: ClaimKind.Emotive, claimId }, CLIENT_ACTOR),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('lists attachments for a client once the claim is client-visible', async () => {
      const customerId = await getCustomerIdByName(ctx.db, 'SELMAN')
      await linkUserToCustomer(customerId)
      const claimId = await createEmotiveClaimForCustomer(customerId)

      await container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Emotive,
          claimId,
          visibility: AttachmentVisibility.ClientVisible,
          files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        },
        {
          id: TEST_USER_ID,
          // `change_visibility` since 2026-08-17: marking a file client-visible is gated now.
          permissions: [
            'attachments.upload',
            'attachments.change_visibility',
            'emotive_claims.view',
          ],
        },
        auditContext,
      )

      await ctx.db
        .update(schema.emotiveClaims)
        .set({ clientVisibleAt: new Date() })
        .where(eq(schema.emotiveClaims.id, claimId))

      const list = await container.attachmentsService.list(
        { claimKind: ClaimKind.Emotive, claimId },
        CLIENT_ACTOR,
      )
      expect(list.items).toHaveLength(1)
    })
  })

  describe('client_content_updated_at bump on client-visible attachment changes (Phase 3 freshness)', () => {
    const uploader = {
      id: TEST_USER_ID,
      // `change_visibility` since 2026-08-17 — this block uploads client-visible files on purpose.
      permissions: ['attachments.upload', 'attachments.change_visibility', 'emotive_claims.view'],
    }
    const deleter = {
      id: TEST_USER_ID,
      permissions: ['attachments.view_internal', 'attachments.delete_any', 'emotive_claims.view'],
    }

    async function createEmotiveClaim(): Promise<string> {
      const engineType = await createTestEngineType(
        container,
        `FRESH-EMO-${crypto.randomUUID().slice(0, 8)}`,
      )
      const created = await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          categoryId: await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA'),
          dateOfClaim: new Date('2026-04-17'),
          mrNumber: `FRESH-${crypto.randomUUID().slice(0, 8)}/26`,
          outcome: ClaimOutcome.Pending,
          faults: [],
          findings: [],
        },
        { id: TEST_USER_ID, permissions: ['emotive_claims.view', 'emotive_claims.create'] },
        auditContext,
      )
      return created.id
    }

    async function getClientContentUpdatedAt(claimId: string): Promise<Date | null> {
      const [row] = await ctx.db
        .select({ clientContentUpdatedAt: schema.emotiveClaims.clientContentUpdatedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, claimId))
      return row?.clientContentUpdatedAt ?? null
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-07-18T09:00:00Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('bumps client_content_updated_at when a client-visible photo is uploaded', async () => {
      const claimId = await createEmotiveClaim()
      // Basic identifying fields (engineTypeId/dateOfClaim/mrNumber) are always present on
      // create, so client_content_updated_at is already stamped at the creation time.
      const before = await getClientContentUpdatedAt(claimId)
      expect(before).toEqual(new Date('2026-07-18T09:00:00Z'))

      vi.setSystemTime(new Date('2026-07-18T09:05:00Z'))
      await container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Emotive,
          claimId,
          // Photos are client-visible regardless of the visibility flag (2026-07-04 rule).
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        },
        uploader,
        auditContext,
      )

      const after = await getClientContentUpdatedAt(claimId)
      expect(after).toEqual(new Date('2026-07-18T09:05:00Z'))
      expect(after!.getTime()).toBeGreaterThan(before!.getTime())
    })

    it('does NOT bump client_content_updated_at when an internal (non-image) document is uploaded', async () => {
      const claimId = await createEmotiveClaim()
      const before = await getClientContentUpdatedAt(claimId)

      vi.setSystemTime(new Date('2026-07-18T09:05:00Z'))
      await container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Emotive,
          claimId,
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'report.pdf', data: Buffer.from('%PDF-1.4\n% internal doc') }],
        },
        uploader,
        auditContext,
      )

      const after = await getClientContentUpdatedAt(claimId)
      expect(after).toEqual(before)
    })

    it('does NOT bump client_content_updated_at when a client-visible photo is deleted, but still fires the SSE', async () => {
      // A removal is not new content to look at → no NEW/UPDATE badge. But the realtime
      // signal must still fire so a client currently viewing the claim sees it disappear.
      const eventBus = new RecordingEventBus()
      const scopedContainer = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, eventBus)

      const claimId = await createEmotiveClaim()

      const uploaded = await container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Emotive,
          claimId,
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        },
        uploader,
        auditContext,
      )
      const attachmentId = uploaded.items[0]?.id
      expect(attachmentId).toBeDefined()
      const beforeDelete = await getClientContentUpdatedAt(claimId)

      vi.setSystemTime(new Date('2026-07-18T09:10:00Z'))
      await scopedContainer.attachmentsService.delete(attachmentId!, deleter, auditContext)

      expect(await getClientContentUpdatedAt(claimId)).toEqual(beforeDelete)
      expect(eventBus.events).toContainEqual(
        expect.objectContaining({
          type: 'updated',
          payload: { kind: ClaimKind.Emotive, id: claimId },
        }),
      )
    })
  })

  describe('section_updated_at.photos bump on client-visible attachment changes (Phase 3.1)', () => {
    const uploader = {
      id: TEST_USER_ID,
      // `change_visibility` since 2026-08-17 — this block uploads client-visible files on purpose.
      permissions: ['attachments.upload', 'attachments.change_visibility', 'emotive_claims.view'],
    }
    const deleter = {
      id: TEST_USER_ID,
      permissions: ['attachments.view_internal', 'attachments.delete_any', 'emotive_claims.view'],
    }

    async function createEmotiveClaim(): Promise<string> {
      const engineType = await createTestEngineType(
        container,
        `SECFRESH-EMO-${crypto.randomUUID().slice(0, 8)}`,
      )
      const created = await container.emotiveClaimsService.create(
        {
          engineTypeId: engineType.id,
          categoryId: await getClaimCategoryIdByCode(ctx.db, 'REMONT_MOTORA'),
          dateOfClaim: new Date('2026-04-17'),
          mrNumber: `SECFRESH-${crypto.randomUUID().slice(0, 8)}/26`,
          outcome: ClaimOutcome.Pending,
          faults: [],
          findings: [],
        },
        { id: TEST_USER_ID, permissions: ['emotive_claims.view', 'emotive_claims.create'] },
        auditContext,
      )
      return created.id
    }

    async function getSectionUpdatedAt(claimId: string): Promise<Record<string, string> | null> {
      const [row] = await ctx.db
        .select({ sectionUpdatedAt: schema.emotiveClaims.sectionUpdatedAt })
        .from(schema.emotiveClaims)
        .where(eq(schema.emotiveClaims.id, claimId))
      return row?.sectionUpdatedAt ?? null
    }

    it('sets section_updated_at.photos when a client-visible photo is uploaded', async () => {
      const claimId = await createEmotiveClaim()

      await container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Emotive,
          claimId,
          // Photos are client-visible regardless of the visibility flag (2026-07-04 rule).
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        },
        uploader,
        auditContext,
      )

      const sections = await getSectionUpdatedAt(claimId)
      expect(sections?.['photos']).toBeDefined()
    })

    it('does NOT set section_updated_at.photos when an internal (non-image) document is uploaded', async () => {
      const claimId = await createEmotiveClaim()

      await container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Emotive,
          claimId,
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'report.pdf', data: Buffer.from('%PDF-1.4\n% internal doc') }],
        },
        uploader,
        auditContext,
      )

      const sections = await getSectionUpdatedAt(claimId)
      expect(sections?.['photos']).toBeUndefined()
    })

    it('does NOT re-stamp section_updated_at.photos when a client-visible photo is deleted', async () => {
      const claimId = await createEmotiveClaim()

      const uploaded = await container.attachmentsService.upload(
        {
          claimKind: ClaimKind.Emotive,
          claimId,
          visibility: AttachmentVisibility.Internal,
          files: [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        },
        uploader,
        auditContext,
      )
      const attachmentId = uploaded.items[0]?.id
      expect(attachmentId).toBeDefined()

      // The upload stamped 'photos'; deleting must leave it exactly as-is (no re-bump).
      const beforeDelete = await getSectionUpdatedAt(claimId)
      expect(beforeDelete?.['photos']).toBeDefined()

      await container.attachmentsService.delete(attachmentId!, deleter, auditContext)

      const sections = await getSectionUpdatedAt(claimId)
      expect(sections?.['photos']).toBe(beforeDelete?.['photos'])
    })
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
