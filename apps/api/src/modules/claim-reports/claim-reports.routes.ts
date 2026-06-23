import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import { createClaimReportsController } from './claim-reports.controller.js'

export function registerClaimReportsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createClaimReportsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', requirePermission('claim_reports.view'), controller.get)
  routes.put('/', requirePermission('claim_reports.update'), controller.upsert)
  routes.post('/images', requirePermission('claim_reports.update'), controller.uploadImage)

  app.route('/api/claim-reports', routes)
}
