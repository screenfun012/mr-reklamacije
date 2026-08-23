import { INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS } from '@mr/shared'
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

  /**
   * „Does a claim with this MR number exist, and which one is it" — nothing more crosses (the
   * response is `{ kind, claimId }`).
   *
   * Gated on CREATE **and** on the internal read sets since 2026-08-23: the chat turns an MR
   * number in any message into a link, and a viewer holds neither create permission — every chip
   * would have answered 403 and rendered as plain text, which reads as a broken feature. Whoever
   * may read claims already sees every MR number in the list, so this widens nothing in practice.
   * ⚠ The INTERNAL sets, never `*_view_own_customer`: that one belongs to a portal client.
   */
  routes.get(
    '/lookup',
    requirePermissions(
      'emotive_claims.create',
      'domace_claims.create',
      ...INTERNAL_CLAIMS_LIST_VIEW_PERMISSIONS,
    ),
    controller.lookup,
  )

  app.route('/api/mr-registry', routes)
}
