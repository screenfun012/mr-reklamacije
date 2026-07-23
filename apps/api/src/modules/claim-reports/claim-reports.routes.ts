import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import { exportTimeout } from '../../core/middleware/export-timeout.js'
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
  // A Chromium render waits behind a 2-slot queue; without a ceiling a stuck one
  // holds its slot and callers just wait until Cloudflare cuts them off.
  exportRoutes.use('*', exportTimeout)
  exportRoutes.get('/pdf', requirePermission('claim_reports.export'), controller.exportPdf)
  exportRoutes.get('/docx', requirePermission('claim_reports.export'), controller.exportDocx)
  // Client portal: same report document, gated by own-claims export; row-level
  // ownership is enforced in the service (404 for a claim the client doesn't own).
  exportRoutes.get(
    '/client/pdf',
    requirePermission('export.own_claims'),
    controller.exportClientPdf,
  )

  app.route('/api/claim-reports/export', exportRoutes)
  app.route('/api/claim-reports', routes)
}
