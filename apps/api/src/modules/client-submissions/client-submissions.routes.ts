import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { clientSubmissionRateLimiter } from '../../core/middleware/rate-limit.js'
import { createClientSubmissionsController } from './client-submissions.controller.js'

export function registerClientSubmissionsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createClientSubmissionsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  // Portal client intake — write-gated + rate limited (20/h per user, defense in depth).
  routes.post(
    '/',
    clientSubmissionRateLimiter,
    requirePermission('client_submissions.create'),
    controller.create,
  )

  // Internal Inbox — operator/admin only. `/pending-count` is registered before `/:id` so the
  // static nav-badge route never falls into the id param matcher.
  routes.get('/', requirePermission('client_submissions.manage'), controller.list)
  routes.get(
    '/pending-count',
    requirePermission('client_submissions.manage'),
    controller.pendingCount,
  )
  routes.get('/:id', requirePermission('client_submissions.manage'), controller.findById)
  routes.post('/:id/convert', requirePermission('client_submissions.manage'), controller.convert)
  routes.post('/:id/reject', requirePermission('client_submissions.manage'), controller.reject)

  // Attachments — the submission OWNER (client, `.create`) or an operator/admin (`.manage`); the
  // service refines to ownership and returns 404 (not 403) for a non-owning client.
  const submissionAttachmentAccess = requirePermissions(
    'client_submissions.create',
    'client_submissions.manage',
  )
  routes.post('/:id/attachments', submissionAttachmentAccess, controller.uploadAttachments)
  routes.get('/:id/attachments', submissionAttachmentAccess, controller.listAttachments)
  routes.get(
    '/:id/attachments/:attachmentId/download',
    submissionAttachmentAccess,
    controller.downloadAttachment,
  )

  app.route('/api/client-submissions', routes)
}
