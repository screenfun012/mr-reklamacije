import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createExternalPartiesController } from './external-parties.controller.js'

export function registerExternalPartiesRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createExternalPartiesController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/',
    requirePermissions(
      'emotive_claims.create',
      'emotive_claims.update',
      'settings.external_parties.create',
      'settings.external_parties.manage',
    ),
    controller.list,
  )
  routes.post(
    '/',
    requirePermissions('settings.external_parties.create', 'settings.external_parties.manage'),
    controller.create,
  )
  routes.patch('/:id', requirePermission('settings.external_parties.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.external_parties.manage'), controller.delete)

  app.route('/api/external-parties', routes)
}
