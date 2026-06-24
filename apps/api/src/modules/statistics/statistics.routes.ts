import { STATISTICS_VIEW_PERMISSIONS } from '@mr/shared'
import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createStatisticsController } from './statistics.controller.js'

export function registerStatisticsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createStatisticsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/summary', requirePermissions(...STATISTICS_VIEW_PERMISSIONS), controller.summary)

  app.route('/api/statistics', routes)
}
