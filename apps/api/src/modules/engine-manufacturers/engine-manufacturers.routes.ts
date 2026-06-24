import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createEngineManufacturersController } from './engine-manufacturers.controller.js'

export function registerEngineManufacturersRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createEngineManufacturersController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/',
    requirePermissions(
      'emotive_claims.create',
      'emotive_claims.update',
      'domace_claims.create',
      'domace_claims.update',
      'settings.engine_manufacturers.manage',
      'settings.engine_manufacturers.create',
    ),
    controller.list,
  )
  routes.post(
    '/',
    requirePermissions(
      'settings.engine_manufacturers.create',
      'settings.engine_manufacturers.manage',
    ),
    controller.create,
  )
  routes.patch('/:id', requirePermission('settings.engine_manufacturers.manage'), controller.update)
  routes.delete(
    '/:id',
    requirePermission('settings.engine_manufacturers.manage'),
    controller.delete,
  )

  app.route('/api/engine-manufacturers', routes)
}
