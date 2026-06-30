import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createUsersController } from './users.controller.js'

export function registerUsersRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createUsersController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', requirePermission('users.view'), controller.list)
  routes.patch(
    '/:id/account-status',
    requirePermissions('users.approve_registration', 'users.reject_registration'),
    controller.updateAccountStatus,
  )
  routes.put('/:id/roles', requirePermission('roles.assign'), controller.replaceRoles)
  routes.post(
    '/:id/reset-password',
    requirePermission('users.reset_password'),
    controller.resetPassword,
  )
  routes.post(
    '/:id/resend-activation',
    requirePermission('users.approve_registration'),
    controller.resendActivation,
  )

  app.route('/api/users', routes)
}
