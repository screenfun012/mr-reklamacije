import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createEngineTypesController } from './engine-types.controller.js'

export function registerEngineTypesRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createEngineTypesController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/',
    // Claim VIEWERS read the catalog too — the list's engine-type filter needs it, and they
    // already see engine-type codes on every claim row. Same widening the manufacturers
    // catalog got: without it the filter dropdown takes a read-only account's whole screen
    // down with a 403. Mutations below stay settings-gated.
    requirePermissions(
      'emotive_claims.view',
      'domace_claims.view',
      'emotive_claims.create',
      'emotive_claims.update',
      'domace_claims.create',
      'domace_claims.update',
      'settings.engine_types.create',
      'settings.engine_types.manage',
    ),
    controller.list,
  )
  routes.post(
    '/',
    requirePermissions('settings.engine_types.create', 'settings.engine_types.manage'),
    controller.create,
  )
  routes.patch('/:id', requirePermission('settings.engine_types.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.engine_types.manage'), controller.delete)

  app.route('/api/engine-types', routes)
}
