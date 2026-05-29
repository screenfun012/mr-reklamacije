import { Hono } from 'hono'

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
    requirePermissions('emotive_claims.create', 'emotive_claims.update'),
    controller.list,
  )

  app.route('/api/claim-sources', routes)
}
