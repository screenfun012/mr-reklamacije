import { ClaimKind } from '@mr/shared'
import type { Context } from 'hono'
import { z } from 'zod'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError, ValidationError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import { buildAttachmentContentDisposition } from '../../core/http/content-disposition.js'
import { ClaimReportQuerySchema, ClaimReportUpsertBodySchema } from './claim-reports.validators.js'
import type { ClaimReportsActor } from './claim-reports.types.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

function toActor(user: MRSessionUser): ClaimReportsActor {
  return { id: user.id, permissions: user.permissions }
}

export function createClaimReportsController(container: Container): {
  get: (c: Context) => Promise<Response>
  upsert: (c: Context) => Promise<Response>
  uploadImage: (c: Context) => Promise<Response>
  exportPdf: (c: Context) => Promise<Response>
  exportDocx: (c: Context) => Promise<Response>
} {
  return {
    get: async (c: Context) => {
      const user = requireUser(c)
      const query = ClaimReportQuerySchema.parse(c.req.query())
      const result = await container.claimReportsService.get(query, toActor(user))
      return c.json(result)
    },

    upsert: async (c: Context) => {
      const user = requireUser(c)
      const query = ClaimReportQuerySchema.parse(c.req.query())
      const body = ClaimReportUpsertBodySchema.parse(await c.req.json())
      const result = await container.claimReportsService.upsert(
        query,
        body,
        toActor(user),
        getActorContext(c, user),
      )
      return c.json(result)
    },

    uploadImage: async (c: Context) => {
      const user = requireUser(c)
      const formData = await c.req.formData()

      const claimKindRaw = formData.get('claimKind')
      const claimIdRaw = formData.get('claimId')
      const fileEntry = formData.get('file')

      const claimKind = z.enum([ClaimKind.Emotive, ClaimKind.Domace]).parse(claimKindRaw)
      const claimId = z.string().uuid().parse(claimIdRaw)

      if (fileEntry === null || typeof fileEntry === 'string') {
        throw new ValidationError('No image uploaded')
      }

      const fileName =
        'name' in fileEntry && typeof fileEntry.name === 'string' && fileEntry.name.length > 0
          ? fileEntry.name
          : 'upload'
      const data = Buffer.from(await fileEntry.arrayBuffer())

      const result = await container.attachmentsService.uploadReportImage(
        {
          claimKind,
          claimId,
          file: { fileName, data },
        },
        { id: user.id, permissions: user.permissions },
        getActorContext(c, user),
      )

      return c.json(result, 201)
    },

    exportPdf: async (c: Context) => {
      const user = requireUser(c)
      const query = ClaimReportQuerySchema.parse(c.req.query())
      const result = await container.claimReportsService.exportPdf(
        query,
        toActor(user),
        getActorContext(c, user),
      )

      return new Response(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': buildAttachmentContentDisposition(result.fileName),
          'Cache-Control': 'no-store',
        },
      })
    },

    exportDocx: async (c: Context) => {
      const user = requireUser(c)
      const query = ClaimReportQuerySchema.parse(c.req.query())
      const result = await container.claimReportsService.exportDocx(
        query,
        toActor(user),
        getActorContext(c, user),
      )

      return new Response(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          'Content-Type': result.mimeType,
          'Content-Disposition': buildAttachmentContentDisposition(result.fileName),
          'Cache-Control': 'no-store',
        },
      })
    },
  }
}
