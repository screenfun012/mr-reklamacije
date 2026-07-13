import { mkdir, rm } from 'node:fs/promises'

import { schema } from '@mr/db'
import { ClientSubmissionStatus, CustomerKind } from '@mr/shared'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AppVariables } from '../../../app.js'
import type { MRSessionUser } from '../../../core/auth/session-types.js'
import type { Container } from '../../../core/container.js'
import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '../../../core/errors/domain-errors.js'
import { registerGlobalErrorHandler } from '../../../core/middleware/error-handler.js'
import { ensureTestUser, TEST_USER_ID } from '../../../test-helpers/fixtures.js'
import { RecordingEventBus } from '../../../test-helpers/recording-event-bus.js'
import { buildTestContainer, testUser } from '../../../test-helpers/test-app.js'
import { createTestDbContext, type TestDbContext } from '../../../test-helpers/test-db.js'
import { registerClientSubmissionsRoutes } from '../index.js'

const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
])

const auditContext = { actorUserId: TEST_USER_ID, actorIp: null, actorUserAgent: null }

function suffix(): string {
  return crypto.randomUUID().slice(0, 8)
}

function ownerActor(id: string): { id: string; permissions: readonly string[] } {
  return { id, permissions: ['client_submissions.create'] }
}

function manageActor(): { id: string; permissions: readonly string[] } {
  return { id: TEST_USER_ID, permissions: ['client_submissions.manage'] }
}

function appFor(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)
  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })
  registerClientSubmissionsRoutes(app, container)
  return app
}

describe('Submission attachments', () => {
  let ctx: TestDbContext
  let container: Container

  beforeEach(async () => {
    ctx = await createTestDbContext()
    container = buildTestContainer(ctx.db, ctx.pool, ctx.databaseUrl, new RecordingEventBus())
    await ensureTestUser(ctx.db)
    await mkdir(container.env.UPLOAD_DIR, { recursive: true })
  })

  afterEach(async () => {
    await rm(container.env.UPLOAD_DIR, { recursive: true, force: true })
    await ctx.cleanup()
  })

  async function seedUser(): Promise<string> {
    const id = crypto.randomUUID()
    await ctx.db
      .insert(schema.users)
      .values({ id, email: `sub-att-${id}@mrengines.rs`, name: 'Client' })
    return id
  }

  async function seedCustomer(): Promise<string> {
    const [customer] = await ctx.db
      .insert(schema.customers)
      .values({ kind: CustomerKind.EmotivePartner, name: `Partner ${suffix()}` })
      .returning({ id: schema.customers.id })
    return customer!.id
  }

  async function seedSubmission(
    customerId: string,
    submitterId: string,
    status: ClientSubmissionStatus = ClientSubmissionStatus.Pending,
  ): Promise<string> {
    const { id } = await container.clientSubmissionsRepository.create({
      customerId,
      submittedByUserId: submitterId,
      message: 'Motor lupa nakon ugradnje',
    })
    if (status !== ClientSubmissionStatus.Pending) {
      await ctx.db
        .update(schema.clientSubmissions)
        .set({ status })
        .where(eq(schema.clientSubmissions.id, id))
    }
    return id
  }

  /** Owner client + linked customer + a pending submission they submitted. */
  async function seedOwnedSubmission(): Promise<{ ownerId: string; submissionId: string }> {
    const ownerId = await seedUser()
    const customerId = await seedCustomer()
    await ctx.db
      .insert(schema.customerUsers)
      .values({ customerId, userId: ownerId, assignedBy: TEST_USER_ID })
    const submissionId = await seedSubmission(customerId, ownerId)
    return { ownerId, submissionId }
  }

  describe('service authorization', () => {
    it('owner uploads to own pending submission: row has client_submission_id + claim_kind NULL', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()

      const result = await container.attachmentsService.uploadToSubmission(
        submissionId,
        [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        ownerActor(ownerId),
        auditContext,
      )

      expect(result.items).toHaveLength(1)
      expect(result.skippedDuplicates).toBe(0)

      const raw = await container.attachmentsRepository.findRawById(result.items[0]!.id)
      expect(raw).not.toBeNull()
      expect(raw?.clientSubmissionId).toBe(submissionId)
      expect(raw?.claimKind).toBeNull()
      expect(raw?.emotiveClaimId).toBeNull()
      expect(raw?.domaceClaimId).toBeNull()
      expect(raw?.uploadedBy).toBe(ownerId)
      expect(await container.storageService.exists(raw?.storagePath ?? '')).toBe(true)
    })

    it('owner lists and downloads their own submission attachments', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()
      const uploaded = await container.attachmentsService.uploadToSubmission(
        submissionId,
        [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        ownerActor(ownerId),
        auditContext,
      )

      const list = await container.attachmentsService.listForSubmission(
        submissionId,
        ownerActor(ownerId),
      )
      expect(list.items).toHaveLength(1)
      expect(list.items[0]?.id).toBe(uploaded.items[0]!.id)

      const meta = await container.attachmentsService.getSubmissionDownloadMeta(
        submissionId,
        uploaded.items[0]!.id,
        ownerActor(ownerId),
        'original',
      )
      expect(meta.mimeType).toBe('image/jpeg')
      const { stream, size } = await container.attachmentsService.openDownloadStream(
        meta.storagePath,
      )
      expect(size).toBeGreaterThan(0)
      await stream.cancel()
    })

    it('SECURITY: a DIFFERENT client gets 404 on upload/list/download (no existence leak)', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()
      const uploaded = await container.attachmentsService.uploadToSubmission(
        submissionId,
        [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        ownerActor(ownerId),
        auditContext,
      )
      const attacker = ownerActor(await seedUser())

      await expect(
        container.attachmentsService.uploadToSubmission(
          submissionId,
          [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
          attacker,
          auditContext,
        ),
      ).rejects.toBeInstanceOf(NotFoundError)

      await expect(
        container.attachmentsService.listForSubmission(submissionId, attacker),
      ).rejects.toBeInstanceOf(NotFoundError)

      await expect(
        container.attachmentsService.getSubmissionDownloadMeta(
          submissionId,
          uploaded.items[0]!.id,
          attacker,
          'original',
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('an operator with .manage can list and download any submission attachment', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()
      const uploaded = await container.attachmentsService.uploadToSubmission(
        submissionId,
        [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        ownerActor(ownerId),
        auditContext,
      )

      const list = await container.attachmentsService.listForSubmission(submissionId, manageActor())
      expect(list.items).toHaveLength(1)

      const meta = await container.attachmentsService.getSubmissionDownloadMeta(
        submissionId,
        uploaded.items[0]!.id,
        manageActor(),
        'original',
      )
      expect(meta.fileName).toBe('engine.jpg')
    })

    it('a missing submission is 404 for an owner-permissioned client', async () => {
      await expect(
        container.attachmentsService.listForSubmission(
          crypto.randomUUID(),
          ownerActor(await seedUser()),
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it("an attachment cannot be fetched through another submission's route", async () => {
      const first = await seedOwnedSubmission()
      const uploaded = await container.attachmentsService.uploadToSubmission(
        first.submissionId,
        [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        ownerActor(first.ownerId),
        auditContext,
      )
      const otherCustomer = await seedCustomer()
      const otherSubmission = await seedSubmission(otherCustomer, first.ownerId)

      // Owner has access to `otherSubmission`, but the attachment belongs to `first` → 404.
      await expect(
        container.attachmentsService.getSubmissionDownloadMeta(
          otherSubmission,
          uploaded.items[0]!.id,
          ownerActor(first.ownerId),
          'original',
        ),
      ).rejects.toBeInstanceOf(NotFoundError)
    })

    it('rejects uploads to a converted submission', async () => {
      const ownerId = await seedUser()
      const customerId = await seedCustomer()
      const submissionId = await seedSubmission(
        customerId,
        ownerId,
        ClientSubmissionStatus.Converted,
      )

      await expect(
        container.attachmentsService.uploadToSubmission(
          submissionId,
          [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
          ownerActor(ownerId),
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('rejects uploads to a rejected submission', async () => {
      const ownerId = await seedUser()
      const customerId = await seedCustomer()
      const submissionId = await seedSubmission(
        customerId,
        ownerId,
        ClientSubmissionStatus.Rejected,
      )

      await expect(
        container.attachmentsService.uploadToSubmission(
          submissionId,
          [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
          ownerActor(ownerId),
          auditContext,
        ),
      ).rejects.toBeInstanceOf(ConflictError)
    })

    it('rejects an unsupported file type (magic-byte check)', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()

      await expect(
        container.attachmentsService.uploadToSubmission(
          submissionId,
          [{ fileName: 'notes.txt', data: Buffer.from('plain text') }],
          ownerActor(ownerId),
          auditContext,
        ),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeError)
    })

    it('rejects an oversized file', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()
      const oversized = Buffer.alloc(26 * 1024 * 1024)

      await expect(
        container.attachmentsService.uploadToSubmission(
          submissionId,
          [{ fileName: 'huge.jpg', data: oversized }],
          ownerActor(ownerId),
          auditContext,
        ),
      ).rejects.toBeInstanceOf(PayloadTooLargeError)
    })
  })

  describe('HTTP routes', () => {
    it('owner client uploads, lists and downloads over HTTP', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()
      const app = appFor(container, testUser(['client_submissions.create'], ownerId, ['client']))

      const formData = new FormData()
      formData.set('files', new File([MINIMAL_JPEG], 'engine.jpg', { type: 'image/jpeg' }))

      const uploadRes = await app.request(`/api/client-submissions/${submissionId}/attachments`, {
        method: 'POST',
        body: formData,
      })
      expect(uploadRes.status).toBe(201)
      const uploadBody = (await uploadRes.json()) as { items: Array<{ id: string }> }
      const attachmentId = uploadBody.items[0]?.id
      expect(attachmentId).toBeDefined()

      const listRes = await app.request(`/api/client-submissions/${submissionId}/attachments`)
      expect(listRes.status).toBe(200)
      const listBody = (await listRes.json()) as { items: unknown[] }
      expect(listBody.items).toHaveLength(1)

      const downloadRes = await app.request(
        `/api/client-submissions/${submissionId}/attachments/${attachmentId}/download`,
      )
      expect(downloadRes.status).toBe(200)
      expect(downloadRes.headers.get('content-type')).toBe('image/jpeg')
      expect(downloadRes.headers.get('x-content-type-options')).toBe('nosniff')
      expect(downloadRes.headers.get('content-disposition')).toContain('inline')
    })

    it('SECURITY: a different client gets 404 on list/upload/download over HTTP', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()
      const owner = appFor(container, testUser(['client_submissions.create'], ownerId, ['client']))

      const formData = new FormData()
      formData.set('files', new File([MINIMAL_JPEG], 'engine.jpg', { type: 'image/jpeg' }))
      const uploadRes = await owner.request(`/api/client-submissions/${submissionId}/attachments`, {
        method: 'POST',
        body: formData,
      })
      const attachmentId = ((await uploadRes.json()) as { items: Array<{ id: string }> }).items[0]!
        .id

      const attacker = appFor(
        container,
        testUser(['client_submissions.create'], await seedUser(), ['client']),
      )

      const listRes = await attacker.request(`/api/client-submissions/${submissionId}/attachments`)
      expect(listRes.status).toBe(404)

      const attackForm = new FormData()
      attackForm.set('files', new File([MINIMAL_JPEG], 'x.jpg', { type: 'image/jpeg' }))
      const attackUpload = await attacker.request(
        `/api/client-submissions/${submissionId}/attachments`,
        { method: 'POST', body: attackForm },
      )
      expect(attackUpload.status).toBe(404)

      const attackDownload = await attacker.request(
        `/api/client-submissions/${submissionId}/attachments/${attachmentId}/download`,
      )
      expect(attackDownload.status).toBe(404)
    })

    it('an operator with .manage lists attachments over HTTP', async () => {
      const { ownerId, submissionId } = await seedOwnedSubmission()
      await container.attachmentsService.uploadToSubmission(
        submissionId,
        [{ fileName: 'engine.jpg', data: MINIMAL_JPEG }],
        ownerActor(ownerId),
        auditContext,
      )
      const app = appFor(container, testUser(['client_submissions.manage']))

      const res = await app.request(`/api/client-submissions/${submissionId}/attachments`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { items: unknown[] }
      expect(body.items).toHaveLength(1)
    })

    it('a user with neither submission permission is 403 (route permission gate)', async () => {
      const { submissionId } = await seedOwnedSubmission()
      const app = appFor(container, testUser(['domace_claims.view']))

      const res = await app.request(`/api/client-submissions/${submissionId}/attachments`)
      expect(res.status).toBe(403)
    })
  })
})
