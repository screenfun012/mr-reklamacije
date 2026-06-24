import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import { excelExportRateLimiter } from '../../core/middleware/rate-limit.js'
import { createExcelController } from './excel.controller.js'

export function registerExcelRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createExcelController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.use('*', excelExportRateLimiter)
  routes.post('/export', requirePermission('export.workbook_partial'), controller.exportWorkbook)

  app.route('/api/excel', routes)
}
