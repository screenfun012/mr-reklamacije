import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import { exportTimeout } from '../../core/middleware/export-timeout.js'
import { createExcelController } from './excel.controller.js'

export function registerExcelRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createExcelController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.use('*', container.rateLimiters.excelExport)
  // The workbook is built entirely in heap with no LIMIT (docs/20 W3) — a ceiling
  // here is what turns "the export button is dead" into an error the user sees.
  routes.use('*', exportTimeout)
  routes.post('/export', requirePermission('export.workbook_partial'), controller.exportWorkbook)

  app.route('/api/excel', routes)
}
