import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createDomaceClaimsController } from './domace-claims.controller.js'

const viewClaimPermissions = requirePermissions(
  'domace_claims.view',
  'domace_claims.view_own_customer',
)

export function registerDomaceClaimsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createDomaceClaimsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', viewClaimPermissions, controller.list)
  routes.get('/:id', viewClaimPermissions, controller.findById)
  routes.post('/', requirePermission('domace_claims.create'), controller.create)
  routes.patch('/:id', requirePermission('domace_claims.update'), controller.update)
  routes.patch('/:id/amount', requirePermission('domace_claims.update'), controller.updateAmount)
  routes.delete('/:id', requirePermission('domace_claims.delete'), controller.softDelete)
  routes.post(
    '/:id/change-outcome',
    requirePermission('domace_claims.change_outcome'),
    controller.changeOutcome,
  )

  app.route('/api/domace-claims', routes)
}
