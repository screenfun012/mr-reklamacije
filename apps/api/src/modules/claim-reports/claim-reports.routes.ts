import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import { claimReportExportRateLimiter } from '../../core/middleware/rate-limit.js'
import { createClaimReportsController } from './claim-reports.controller.js'

export function registerClaimReportsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createClaimReportsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()
  const exportRoutes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', requirePermission('claim_reports.view'), controller.get)
  routes.put('/', requirePermission('claim_reports.update'), controller.upsert)
  routes.post('/images', requirePermission('claim_reports.update'), controller.uploadImage)

  exportRoutes.use('*', claimReportExportRateLimiter)
  exportRoutes.get('/pdf', requirePermission('claim_reports.export'), controller.exportPdf)
  exportRoutes.get('/docx', requirePermission('claim_reports.export'), controller.exportDocx)

  app.route('/api/claim-reports/export', exportRoutes)
  app.route('/api/claim-reports', routes)
}
