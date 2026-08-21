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
    // Statistics readers too: that screen filters by this catalogue, and its loader fetches it
    // before drawing. Rights are handed out as small packages that add up, so an account holding
    // "Statistika" and nothing else is real — and it used to die on a 403 from a dropdown.
    requirePermissions(
      'emotive_claims.view',
      'domace_claims.view',
      'emotive_claims.create',
      'emotive_claims.update',
      'domace_claims.create',
      'domace_claims.update',
      'settings.claim_categories.manage',
      'statistics.view_emotive',
      'statistics.view_domace',
      'statistics.view_overall',
    ),
    controller.list,
  )
  routes.post('/', requirePermission('settings.claim_categories.manage'), controller.create)
  routes.patch('/:id', requirePermission('settings.claim_categories.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.claim_categories.manage'), controller.delete)

  app.route('/api/claim-categories', routes)
}
