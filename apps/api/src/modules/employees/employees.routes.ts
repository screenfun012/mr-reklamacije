import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createEmployeesController } from './employees.controller.js'

export function registerEmployeesRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createEmployeesController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', requirePermission('employees.view'), controller.list)
  routes.post('/', requirePermission('employees.create'), controller.create)
  routes.patch('/:id', requirePermission('employees.update'), controller.update)
  routes.delete('/:id', requirePermission('employees.delete'), controller.delete)

  app.route('/api/employees', routes)
}
