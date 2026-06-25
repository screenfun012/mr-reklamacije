import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createCustomersController } from './customers.controller.js'

export function registerCustomersRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createCustomersController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', requirePermission('customers.view'), controller.list)
  routes.post('/', requirePermission('customers.create'), controller.create)
  routes.patch('/:id', requirePermission('customers.update'), controller.update)
  routes.delete('/:id', requirePermission('customers.delete'), controller.delete)

  app.route('/api/customers', routes)
}
