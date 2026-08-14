import type { Context } from 'hono'

import { z } from 'zod'

import { getActorContext } from '../../core/http/actor-context.js'
import {
  parseAttachmentDownloadRequest,
  serveCachedAttachmentDownload,
} from '../../core/http/attachment-download.js'
import { readUploadFiles } from '../../core/http/upload-files.js'
import { ValidationError } from '../../core/errors/domain-errors.js'
import type { MRSessionUser } from '../../core/auth/session-types.js'
import type { Container } from '../../core/container.js'
import { UnauthorizedError } from '../../core/errors/domain-errors.js'
import type { IntakeOrdersActor } from './intake-orders.types.js'
import {
  IntakeNumberCheckQuerySchema,
  IntakeOrderChangeStatusInputSchema,
  IntakeOrderCreateInputSchema,
  IntakeOrderIdParamSchema,
  IntakeOrderListQuerySchema,
  IntakePhotoParamSchema,
  IntakeOrderSignInputSchema,
  IntakeOrderUpdateInputSchema,
  IntakePlateLookupQuerySchema,
} from './intake-orders.validators.js'

function requireUser(c: Context): MRSessionUser {
  const user = c.get('user')
  if (user === null) {
    throw new UnauthorizedError()
  }
  return user
}

function actorOf(user: MRSessionUser): IntakeOrdersActor {
  return { id: user.id, permissions: user.permissions }
}

export function createIntakeOrdersController(container: Container) {
  return {
    list: async (c: Context) => {
      const user = requireUser(c)
      const query = IntakeOrderListQuerySchema.parse(c.req.query())
      return c.json(await container.intakeOrdersService.list(actorOf(user), query))
    },

    summary: async (c: Context) => {
      const user = requireUser(c)
      return c.json(await container.intakeOrdersService.summary(actorOf(user)))
    },

    checkNumber: async (c: Context) => {
      const user = requireUser(c)
      const { number } = IntakeNumberCheckQuerySchema.parse(c.req.query())
      return c.json(await container.intakeOrdersService.checkNumber(number, actorOf(user)))
    },

    lookup: async (c: Context) => {
      requireUser(c)
      const { plate } = IntakePlateLookupQuerySchema.parse(c.req.query())
      return c.json(await container.intakeOrdersService.lookupByPlate(plate))
    },

    detail: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      return c.json(await container.intakeOrdersService.findById(id, actorOf(user)))
    },

    history: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      return c.json(await container.intakeOrdersService.listHistory(id, actorOf(user)))
    },

    create: async (c: Context) => {
      const user = requireUser(c)
      const body: unknown = await c.req.json()
      const input = IntakeOrderCreateInputSchema.parse(body)
      const created = await container.intakeOrdersService.create(input, getActorContext(c, user))
      c.header('Location', `/api/intake-orders/${created.id}`)
      return c.json(created, 201)
    },

    update: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const patch = IntakeOrderUpdateInputSchema.parse(body)
      return c.json(
        await container.intakeOrdersService.update(
          id,
          patch,
          actorOf(user),
          getActorContext(c, user),
        ),
      )
    },

    sign: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = IntakeOrderSignInputSchema.parse(body)
      return c.json(
        await container.intakeOrdersService.sign(
          id,
          input,
          actorOf(user),
          getActorContext(c, user),
        ),
      )
    },

    advance: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      return c.json(
        await container.intakeOrdersService.advance(id, actorOf(user), getActorContext(c, user)),
      )
    },

    changeStatus: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      const body: unknown = await c.req.json()
      const input = IntakeOrderChangeStatusInputSchema.parse(body)
      return c.json(
        await container.intakeOrdersService.changeStatus(
          id,
          input,
          actorOf(user),
          getActorContext(c, user),
        ),
      )
    },

    delete: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      await container.intakeOrdersService.delete(id, actorOf(user), getActorContext(c, user))
      return c.body(null, 204)
    },

    /**
     * One photo per request. The tablet uploads in the background while the serviser works
     * through steps 4 and 5, so a single failure must retry on its own rather than take a whole
     * batch down with it.
     */
    uploadPhoto: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      const formData = await c.req.formData()
      const damageIdRaw = formData.get('damageId')
      const damageId = z
        .string()
        .trim()
        .min(1)
        .max(40)
        .nullable()
        .parse(damageIdRaw ?? null)

      const files = await readUploadFiles(formData)
      const file = files[0]
      if (file === undefined) {
        throw new ValidationError('No photo uploaded')
      }

      const photo = await container.intakeOrdersService.uploadPhoto(
        id,
        file,
        damageId,
        actorOf(user),
        getActorContext(c, user),
      )
      return c.json(photo, 201)
    },

    servePhoto: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      const { attachmentId } = IntakePhotoParamSchema.parse({
        attachmentId: c.req.param('attachmentId'),
      })
      const { disposition, variant } = parseAttachmentDownloadRequest(c)

      const meta = await container.intakeOrdersService.getPhotoDownloadMeta(
        id,
        attachmentId,
        variant,
        actorOf(user),
      )

      return serveCachedAttachmentDownload(c, meta, {
        disposition,
        openStream: (storagePath) => container.intakeOrdersService.openPhotoStream(storagePath),
      })
    },

    /**
     * The sealed document. `attachment`, never `inline`: this is the paper the owner signed, and it
     * is downloaded to be kept or printed rather than skimmed in a browser tab.
     */
    serveDocument: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })

      const meta = await container.intakeOrdersService.getDocumentDownloadMeta(id, actorOf(user))

      return serveCachedAttachmentDownload(c, meta, {
        disposition: 'attachment',
        openStream: (storagePath) => container.intakeOrdersService.openDocumentStream(storagePath),
      })
    },

    deletePhoto: async (c: Context) => {
      const user = requireUser(c)
      const { id } = IntakeOrderIdParamSchema.parse({ id: c.req.param('id') })
      const { attachmentId } = IntakePhotoParamSchema.parse({
        attachmentId: c.req.param('attachmentId'),
      })
      await container.intakeOrdersService.deletePhoto(
        id,
        attachmentId,
        actorOf(user),
        getActorContext(c, user),
      )
      return c.body(null, 204)
    },
  }
}
