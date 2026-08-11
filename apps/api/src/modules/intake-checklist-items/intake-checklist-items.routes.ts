import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createIntakeChecklistItemsController } from './intake-checklist-items.controller.js'

export function registerIntakeChecklistItemsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createIntakeChecklistItemsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  // Managing the catalog is admin-only, but READING it is not: the serviser who fills the wizard
  // holds `intake_orders.view_own`/`create` and no settings permission at all, and the wizard,
  // the detail card and the printed sheet all draw their rows from here (spec §4). The other seven
  // catalogs gate their GET the same way — writes narrow, reads wide.
  routes.get(
    '/',
    requirePermissions(
      'intake_orders.view',
      'intake_orders.view_own',
      'settings.intake_checklist.manage',
    ),
    controller.list,
  )
  routes.post('/', requirePermission('settings.intake_checklist.manage'), controller.create)
  routes.patch('/:id', requirePermission('settings.intake_checklist.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.intake_checklist.manage'), controller.delete)

  app.route('/api/intake-checklist-items', routes)
}
