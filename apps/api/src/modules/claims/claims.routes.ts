import { Hono } from 'hono'

import { INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS } from '@mr/shared'

import type { AppVariables } from '../../app.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createClaimsController } from './claims.controller.js'

const viewClaimsPermissions = requirePermissions(
  'emotive_claims.view',
  'emotive_claims.view_own_customer',
  'domace_claims.view',
  'domace_claims.view_own_customer',
)

export function registerClaimsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createClaimsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', viewClaimsPermissions, controller.list)
  /**
   * The internal sidebar's per-category badges, and ONLY that — no portal screen asks for them.
   *
   * Gated on full view rather than on the list's set: the counts are unscoped and unmasked, so a
   * portal client reading them would learn how many of his claims the shop has already decided
   * before any of it is published to him — the one thing the private→published masking exists to
   * withhold — plus the whole category catalogue with its ids and Serbian names.
   */
  routes.get(
    '/category-counts',
    requirePermissions(...INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS),
    controller.categoryCounts,
  )

  app.route('/api/claims', routes)
}
