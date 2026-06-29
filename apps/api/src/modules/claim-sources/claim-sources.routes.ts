import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createClaimSourcesController } from './claim-sources.controller.js'

export function registerClaimSourcesRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createClaimSourcesController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/',
    requirePermissions(
      'emotive_claims.create',
      'emotive_claims.update',
      'settings.claim_sources.manage',
    ),
    controller.list,
  )
  routes.post('/', requirePermission('settings.claim_sources.manage'), controller.create)
  routes.patch('/:id', requirePermission('settings.claim_sources.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.claim_sources.manage'), controller.delete)

  app.route('/api/claim-sources', routes)
}
