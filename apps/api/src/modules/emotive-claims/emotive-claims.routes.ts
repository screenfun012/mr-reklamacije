import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createEmotiveClaimsController } from './emotive-claims.controller.js'

const viewClaimPermissions = requirePermissions(
  'emotive_claims.view',
  'emotive_claims.view_own_customer',
)

export function registerEmotiveClaimsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createEmotiveClaimsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', viewClaimPermissions, controller.list)
  routes.get('/:id', viewClaimPermissions, controller.findById)
  routes.post('/', requirePermission('emotive_claims.create'), controller.create)
  routes.patch('/:id', requirePermission('emotive_claims.update'), controller.update)
  routes.delete('/:id', requirePermission('emotive_claims.delete'), controller.softDelete)
  routes.post('/:id/restore', requirePermission('emotive_claims.restore'), controller.restore)
  routes.post(
    '/:id/change-outcome',
    requirePermission('emotive_claims.change_outcome'),
    controller.changeOutcome,
  )
  routes.post('/:id/publish', requirePermission('emotive_claims.publish'), controller.publish)

  app.route('/api/emotive-claims', routes)
}
