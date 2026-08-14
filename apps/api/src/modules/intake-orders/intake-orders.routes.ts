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
 * post-signing freeze is enforced in the service, where it cannot be routed around — and it has
 * no permission branch at all: a signed order is closed to everyone, admin included.
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
  // Same gate as the detail: the history is part of reading the order, and the service
  // re-checks row-level scope so a serviser cannot reach a colleague's through it.
  routes.get('/:id/history', canRead, controller.history)
  routes.patch('/:id', requirePermission('intake_orders.update'), controller.update)
  routes.post('/:id/sign', requirePermission('intake_orders.update'), controller.sign)
  routes.post('/:id/advance', requirePermission('intake_orders.advance'), controller.advance)
  // Handing the vehicle back is the last rung of the serviser's own ladder, so it costs what the
  // rungs before it cost. Releasing a car with NOTHING signed is the office's correction instead —
  // it leaves a gap in the evidence, and `change_status` is the permission that owns those.
  routes.post('/:id/handover', requirePermission('intake_orders.advance'), controller.handOver)
  routes.post(
    '/:id/handover/skip',
    requirePermission('intake_orders.change_status'),
    controller.handOverWithoutSignature,
  )
  routes.post(
    '/:id/change-status',
    requirePermission('intake_orders.change_status'),
    controller.changeStatus,
  )
  // Photos live under the order, never under /api/attachments: that route is gated by
  // `attachments.view_internal`, and a serviser holding it could read a claim's files.
  // The same gate as the order it belongs to: whoever may open the order may take its paper.
  routes.get('/:id/document', canRead, controller.serveDocument)
  // Its own permission: this one leaves the shop and lands in a customer's inbox.
  routes.post(
    '/:id/send-document',
    requirePermission('intake_orders.send_document'),
    controller.sendDocument,
  )
  // The way back from a seal that failed. Same permission as sending, because it exists for the same
  // reason — the owner's copy — and a permission of its own would have to be seeded in production
  // before the button could do anything.
  routes.post(
    '/:id/document/produce',
    requirePermission('intake_orders.send_document'),
    controller.produceDocumentAgain,
  )
  routes.get('/:id/photos/:attachmentId', canRead, controller.servePhoto)
  routes.post('/:id/photos', requirePermission('intake_orders.update'), controller.uploadPhoto)
  // Freely while filling the intake in; once signed, refused to everyone — enforced in the
  // service (Nikola, 2026-07-27, tightened 2026-08-11).
  routes.delete(
    '/:id/photos/:attachmentId',
    requirePermission('intake_orders.update'),
    controller.deletePhoto,
  )

  // This gate is an OR — it only asks that the caller be in the conversation at all. Which
  // deletion he may actually perform is decided in the service, where the row is: his OWN
  // unfinished intake goes with `update`, anyone ELSE's draft additionally requires `delete`,
  // and a SIGNED order can no longer be removed by anybody.
  routes.delete(
    '/:id',
    requirePermissions('intake_orders.update', 'intake_orders.delete'),
    controller.delete,
  )

  app.route('/api/intake-orders', routes)
}
