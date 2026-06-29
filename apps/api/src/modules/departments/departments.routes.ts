import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createDepartmentsController } from './departments.controller.js'

export function registerDepartmentsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createDepartmentsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/',
    requirePermissions(
      'emotive_claims.create',
      'emotive_claims.update',
      'domace_claims.create',
      'domace_claims.update',
      'settings.departments.manage',
    ),
    controller.list,
  )
  routes.post('/', requirePermission('settings.departments.manage'), controller.create)
  routes.patch('/:id', requirePermission('settings.departments.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.departments.manage'), controller.delete)

  app.route('/api/departments', routes)
}
