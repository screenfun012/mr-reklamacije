import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createClaimCategoryFieldsController } from './claim-category-fields.controller.js'

export function registerClaimCategoryFieldsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createClaimCategoryFieldsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get(
    '/',
    // The same readers as the category catalogue itself: the claim screens build their forms
    // from this, and the statistics screen counts by it. Mutations stay settings-gated.
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
  // Fields are part of the category catalogue, so they share its permission — one key, one owner.
  routes.post('/', requirePermission('settings.claim_categories.manage'), controller.create)
  routes.patch('/:id', requirePermission('settings.claim_categories.manage'), controller.update)
  routes.delete('/:id', requirePermission('settings.claim_categories.manage'), controller.delete)

  app.route('/api/claim-category-fields', routes)
}
