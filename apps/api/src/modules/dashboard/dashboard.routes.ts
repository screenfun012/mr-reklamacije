import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createDashboardController } from './dashboard.controller.js'

export function registerDashboardRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createDashboardController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  // Internal dashboard aggregates GLOBAL data — full view permissions only.
  // `view_own_customer` (portal clients) must NOT pass; clients use the scoped
  // /client-summary projection below.
  routes.get(
    '/summary',
    requirePermissions('emotive_claims.view', 'domace_claims.view'),
    controller.summary,
  )
  routes.get(
    '/client-summary',
    requirePermissions('emotive_claims.view', 'emotive_claims.view_own_customer'),
    controller.clientSummary,
  )

  app.route('/api/dashboard', routes)
}
