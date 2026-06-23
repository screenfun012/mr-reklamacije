import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createAttachmentsController } from './attachments.controller.js'

const viewAttachmentPermissions = requirePermissions(
  'attachments.view_internal',
  'attachments.view_client_visible',
)

export function registerAttachmentsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createAttachmentsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', viewAttachmentPermissions, controller.list)
  routes.post('/upload', requirePermission('attachments.upload'), controller.upload)
  routes.get('/raw', controller.raw)
  routes.get('/:id/download', viewAttachmentPermissions, controller.download)
  routes.get('/:id/signed-url', viewAttachmentPermissions, controller.signedUrl)
  routes.delete(
    '/:id',
    requirePermissions('attachments.delete_own', 'attachments.delete_any'),
    controller.delete,
  )

  app.route('/api/attachments', routes)
}
