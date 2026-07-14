import { EmotiveClaimCreateInputSchema } from '@mr/shared'
import type { Context } from 'hono'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError, ValidationError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import {
  parseAttachmentDownloadRequest,
  serveCachedAttachmentDownload,
} from '../../core/http/attachment-download.js'
import { readUploadFiles } from '../../core/http/upload-files.js'
import {
  ClientSubmissionCreateInputSchema,
  ClientSubmissionIdParamSchema,
  ClientSubmissionListQuerySchema,
  ClientSubmissionRejectInputSchema,
  SubmissionAttachmentParamSchema,
} from './client-submissions.validators.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

/** The submission attachments service authorizes by permission + ownership from this shape. */
function toActor(user: MRSessionUser): { id: string; permissions: readonly string[] } {
  return { id: user.id, permissions: user.permissions }
}

export function createClientSubmissionsController(container: Container) {
  return {
    /** Portal client submits a ticket for their linked firm → 201 { id } + Location. */
    create: async (c: Context) => {
      const user = requireUser(c)
      const body: unknown = await c.req.json()
      const input = ClientSubmissionCreateInputSchema.parse(body)
      const { id } = await container.clientSubmissionsService.create(
        getActorContext(c, user),
        input,
      )
      c.header('Location', `/api/client-submissions/${id}`)
      return c.json({ id }, 201)
    },

    /** Internal Inbox: pending submissions, newest first. */
    list: async (c: Context) => {
      requireUser(c)
      const query = ClientSubmissionListQuerySchema.parse(c.req.query())
      const result = await container.clientSubmissionsService.listPending({
        page: query.page,
        pageSize: query.pageSize,
      })
      return c.json(result)
    },

    /** Internal Inbox: cheap pending count for the nav badge → { total }. */
    pendingCount: async (c: Context) => {
      requireUser(c)
      const total = await container.clientSubmissionsService.countPending()
      return c.json({ total })
    },

    /** Internal Inbox: one submission's detail (404 when missing). */
    findById: async (c: Context) => {
      requireUser(c)
      const { id } = ClientSubmissionIdParamSchema.parse(c.req.param())
      const submission = await container.clientSubmissionsService.getById(id)
      return c.json(submission)
    },

    /** Convert a pending submission into an EMOTIVE claim → 201 the created claim. */
    convert: async (c: Context) => {
      const user = requireUser(c)
      const { id } = ClientSubmissionIdParamSchema.parse(c.req.param())
      const body: unknown = await c.req.json()
      const input = EmotiveClaimCreateInputSchema.parse(body)
      const claim = await container.clientSubmissionsService.convert(
        getActorContext(c, user),
        id,
        input,
      )
      return c.json(claim, 201)
    },

    /** Dismiss a pending submission with an optional internal reason → 204. */
    reject: async (c: Context) => {
      const user = requireUser(c)
      const { id } = ClientSubmissionIdParamSchema.parse(c.req.param())
      const body: unknown = await c.req.json()
      const input = ClientSubmissionRejectInputSchema.parse(body)
      await container.clientSubmissionsService.reject(
        getActorContext(c, user),
        id,
        input.reason ?? null,
      )
      return c.body(null, 204)
    },

    /** Owner client (or operator) uploads files to a pending submission → 201 { items }. */
    uploadAttachments: async (c: Context) => {
      const user = requireUser(c)
      const { id } = ClientSubmissionIdParamSchema.parse(c.req.param())
      const formData = await c.req.formData()
      const files = await readUploadFiles(formData)
      if (files.length === 0) {
        throw new ValidationError('No files uploaded')
      }

      const result = await container.submissionAttachmentsService.uploadToSubmission(
        id,
        files,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(result, 201)
    },

    /** Owner client (or operator) lists a submission's attachments. */
    listAttachments: async (c: Context) => {
      const user = requireUser(c)
      const { id } = ClientSubmissionIdParamSchema.parse(c.req.param())
      const result = await container.submissionAttachmentsService.listForSubmission(
        id,
        toActor(user),
      )
      return c.json(result)
    },

    /** Owner client (or operator) downloads one submission attachment (streamed, nosniff). */
    downloadAttachment: async (c: Context) => {
      const user = requireUser(c)
      const { id, attachmentId } = SubmissionAttachmentParamSchema.parse(c.req.param())
      const { disposition, variant } = parseAttachmentDownloadRequest(c)

      const meta = await container.submissionAttachmentsService.getSubmissionDownloadMeta(
        id,
        attachmentId,
        toActor(user),
        variant,
      )

      return serveCachedAttachmentDownload(c, meta, {
        disposition,
        openStream: (storagePath) =>
          container.submissionAttachmentsService.openDownloadStream(storagePath),
      })
    },
  }
}
