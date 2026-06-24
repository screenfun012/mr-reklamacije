import { Hono } from 'hono'

import { CLAIMS_LIST_VIEW_PERMISSIONS } from '@mr/shared'

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

  routes.get('/summary', requirePermissions(...CLAIMS_LIST_VIEW_PERMISSIONS), controller.summary)

  app.route('/api/dashboard', routes)
}
