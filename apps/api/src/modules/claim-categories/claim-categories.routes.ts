import { Hono } from 'hono'

import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createClaimCategoriesController } from './claim-categories.controller.js'

export function registerClaimCategoriesRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createClaimCategoriesController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/',
    // Anyone who may see or enter a claim needs to read this catalog — the filter and both
    // create forms are built from it. Mutations below stay settings-gated.
    requirePermissions(
      'emotive_claims.view',
      'domace_claims.view',
      'emotive_claims.create',
      'emotive_claims.update',
      'domace_claims.create',
      'domace_claims.update',
      'settings.claim_categories.manage',
    ),
    controller.list,
  )
  routes.post('/', requirePermission('settings.claim_categories.manage'), controller.create)
  routes.patch('/:id', requirePermission('settings.claim_categories.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.claim_categories.manage'), controller.delete)

  app.route('/api/claim-categories', routes)
}
