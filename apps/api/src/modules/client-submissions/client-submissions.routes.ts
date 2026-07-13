import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
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

  // Internal Inbox — operator/admin only.
  routes.get('/', requirePermission('client_submissions.manage'), controller.list)
  routes.get('/:id', requirePermission('client_submissions.manage'), controller.findById)
  routes.post('/:id/convert', requirePermission('client_submissions.manage'), controller.convert)
  routes.post('/:id/reject', requirePermission('client_submissions.manage'), controller.reject)

  app.route('/api/client-submissions', routes)
}
