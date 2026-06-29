import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createAuditLogController } from './audit-log.controller.js'

export function registerAuditLogRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createAuditLogController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', requirePermission('audit.view'), controller.list)

  app.route('/api/audit-log', routes)
}
