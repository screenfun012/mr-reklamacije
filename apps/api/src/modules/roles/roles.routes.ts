import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import { createRolesController } from './roles.controller.js'

export function registerRolesRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createRolesController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', requirePermission('roles.view'), controller.list)
  routes.post('/', requirePermission('roles.create'), controller.create)
  routes.get('/:id', requirePermission('roles.view'), controller.detail)
  routes.patch('/:id', requirePermission('roles.update'), controller.update)
  routes.post('/:id/duplicate', requirePermission('roles.create'), controller.duplicate)
  routes.delete('/:id', requirePermission('roles.delete'), controller.remove)

  app.route('/api/roles', routes)

  // The matrix the roles screen draws. It lives here because it exists for that screen alone, and
  // it is gated by `roles.view` for the same reason.
  app.get('/api/permissions', requirePermission('roles.view'), controller.listPermissions)
}
