import { Hono } from 'hono'

import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createDepartmentsController } from './departments.controller.js'

export function registerDepartmentsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createDepartmentsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/',
    requirePermissions(
      'emotive_claims.create',
      'emotive_claims.update',
      'domace_claims.create',
      'domace_claims.update',
    ),
    controller.list,
  )

  app.route('/api/departments', routes)
}
