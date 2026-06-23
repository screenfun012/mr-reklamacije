import { AttachmentVisibility, ClaimKind } from '@mr/shared'
import type { Context } from 'hono'
import { z } from 'zod'

import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError, ValidationError } from '../../core/errors/domain-errors.js'
import { getActorContext } from '../../core/http/actor-context.js'
import type { AttachmentsActor } from './attachments.types.js'
import { AttachmentListQuerySchema } from './attachments.validators.js'

const AttachmentIdParamSchema = z.object({
  id: z.string().uuid(),
})

const RawAttachmentQuerySchema = z.object({
  id: z.string().uuid(),
  exp: z.coerce.number().int(),
  sig: z.string().min(1),
})

function toActor(user: MRSessionUser): AttachmentsActor {
  return { id: user.id, permissions: user.permissions }
}

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

function encodeContentDisposition(fileName: string, disposition: 'inline' | 'attachment'): string {
  const safeName = fileName.replace(/[^\w.\- ()[\]]+/g, '_')
  return `${disposition}; filename="${safeName}"`
}

async function readUploadFiles(
  formData: FormData,
): Promise<Array<{ fileName: string; data: Buffer; caption: string | null }>> {
  const entries = [...formData.getAll('files'), ...formData.getAll('file')]
  const captions = formData
    .getAll('caption')
    .map((value) => (typeof value === 'string' ? value : null))
  const files: Array<{ fileName: string; data: Buffer; caption: string | null }> = []

  for (const [index, entry] of entries.entries()) {
    if (typeof entry === 'string') {
      continue
    }

    const fileName =
      'name' in entry && typeof entry.name === 'string' && entry.name.length > 0
        ? entry.name
        : 'upload'
    const data = Buffer.from(await entry.arrayBuffer())
    files.push({
      fileName,
      data,
      caption: captions[index] ?? null,
    })
  }

  return files
}

export function createAttachmentsController(container: Container): {
  list: (c: Context) => Promise<Response>
  upload: (c: Context) => Promise<Response>
  download: (c: Context) => Promise<Response>
  signedUrl: (c: Context) => Promise<Response>
  raw: (c: Context) => Promise<Response>
  delete: (c: Context) => Promise<Response>
} {
  return {
    list: async (c: Context) => {
      const user = requireUser(c)
      const query = AttachmentListQuerySchema.parse(c.req.query())
      const result = await container.attachmentsService.list(query, toActor(user))
      return c.json(result)
    },

    upload: async (c: Context) => {
      const user = requireUser(c)
      const formData = await c.req.formData()

      const claimKindRaw = formData.get('claimKind')
      const claimIdRaw = formData.get('claimId')
      const visibilityRaw = formData.get('visibility')

      const claimKind = z.enum([ClaimKind.Emotive, ClaimKind.Domace]).parse(claimKindRaw)
      const claimId = z.string().uuid().parse(claimIdRaw)
      const visibility = z
        .enum([AttachmentVisibility.Internal, AttachmentVisibility.ClientVisible])
        .parse(visibilityRaw ?? AttachmentVisibility.Internal)

      const files = await readUploadFiles(formData)

      if (files.length === 0) {
        throw new ValidationError('No files uploaded')
      }

      const result = await container.attachmentsService.upload(
        {
          claimKind,
          claimId,
          visibility,
          files,
        },
        toActor(user),
        getActorContext(c, user),
      )

      return c.json(result, 201)
    },

    download: async (c: Context) => {
      const user = requireUser(c)
      const { id } = AttachmentIdParamSchema.parse(c.req.param())
      const disposition = c.req.query('disposition') === 'attachment' ? 'attachment' : 'inline'
      const payload = await container.attachmentsService.getDownloadPayload(
        id,
        toActor(user),
        disposition,
      )

      return new Response(new Uint8Array(payload.data), {
        headers: {
          'Content-Type': payload.mimeType,
          'Content-Disposition': encodeContentDisposition(payload.fileName, payload.disposition),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, no-store',
        },
      })
    },

    signedUrl: async (c: Context) => {
      const user = requireUser(c)
      const { id } = AttachmentIdParamSchema.parse(c.req.param())
      const result = await container.attachmentsService.getSignedUrl(id, toActor(user))
      return c.json(result)
    },

    raw: async (c: Context) => {
      const query = RawAttachmentQuerySchema.parse(c.req.query())
      const payload = await container.attachmentsService.getRawDownloadByToken(
        query.id,
        query.exp,
        query.sig,
      )

      return new Response(new Uint8Array(payload.data), {
        headers: {
          'Content-Type': payload.mimeType,
          'Content-Disposition': encodeContentDisposition(payload.fileName, 'inline'),
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, max-age=300',
        },
      })
    },

    delete: async (c: Context) => {
      const user = requireUser(c)
      const { id } = AttachmentIdParamSchema.parse(c.req.param())
      await container.attachmentsService.delete(id, toActor(user), getActorContext(c, user))
      return c.body(null, 204)
    },
  }
}
