import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createMrRegistryController } from './mr-registry.controller.js'

export function registerMrRegistryRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createMrRegistryController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/lookup',
    requirePermissions('emotive_claims.create', 'domace_claims.create'),
    controller.lookup,
  )

  app.route('/api/mr-registry', routes)
}
