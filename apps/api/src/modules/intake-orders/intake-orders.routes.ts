import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createIntakeOrdersController } from './intake-orders.controller.js'

/**
 * Vehicle service intake (docs/25).
 *
 * Every read is gated by "view or view_own" and the service narrows it further: a caller
 * limited to `view_own` gets 404 — never 403 — for someone else's order, so a serviser
 * cannot even learn that a colleague's intake exists.
 *
 * The route gates are the outer layer only. `update` is held by a serviser too, so the
 * post-signing freeze (the office's `amend`) is enforced in the service, where it cannot be
 * routed around.
 */
export function registerIntakeOrdersRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createIntakeOrdersController(container)
  const routes = new Hono<{ Variables: AppVariables }>()
  const canRead = requirePermissions('intake_orders.view', 'intake_orders.view_own')

  routes.get('/', canRead, controller.list)
  routes.get('/summary', canRead, controller.summary)
  // Both live above `/:id` so a literal path segment never parses as a uuid.
  routes.get('/check-number', requirePermission('intake_orders.create'), controller.checkNumber)
  routes.get('/lookup', requirePermission('intake_orders.create'), controller.lookup)

  routes.post('/', requirePermission('intake_orders.create'), controller.create)
  routes.get('/:id', canRead, controller.detail)
  routes.patch('/:id', requirePermission('intake_orders.update'), controller.update)
  routes.post('/:id/sign', requirePermission('intake_orders.update'), controller.sign)
  routes.post('/:id/advance', requirePermission('intake_orders.advance'), controller.advance)
  routes.post(
    '/:id/change-status',
    requirePermission('intake_orders.change_status'),
    controller.changeStatus,
  )
  // A serviser discards his own unfinished intake with `update`; removing a SIGNED order
  // additionally requires `delete`, checked in the service.
  routes.delete(
    '/:id',
    requirePermissions('intake_orders.update', 'intake_orders.delete'),
    controller.delete,
  )

  app.route('/api/intake-orders', routes)
}
