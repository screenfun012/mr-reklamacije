import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createClaimsController } from './claims.controller.js'

const viewClaimsPermissions = requirePermissions(
  'emotive_claims.view',
  'emotive_claims.view_own_customer',
  'domace_claims.view',
  'domace_claims.view_own_customer',
)

export function registerClaimsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createClaimsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', viewClaimsPermissions, controller.list)

  app.route('/api/claims', routes)
}
