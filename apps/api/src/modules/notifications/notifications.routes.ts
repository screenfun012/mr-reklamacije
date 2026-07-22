import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import { createNotificationsController } from './notifications.controller.js'

/**
 * The whole inbox is self-scoped: every handler reads the caller's id from the session and
 * the service/repository filter on it, so `notifications.view_own` is the only gate needed
 * and a foreign row can only ever 404.
 */
export function registerNotificationsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createNotificationsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()
  const gate = requirePermission('notifications.view_own')

  routes.get('/', gate, controller.list)
  routes.post('/mark-all-read', gate, controller.markAllRead)
  routes.post('/:id/read', gate, controller.markRead)
  routes.post('/:id/snooze', gate, controller.snooze)

  app.route('/api/notifications', routes)
}
