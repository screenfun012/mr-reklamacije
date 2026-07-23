import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import { createPresenceController } from './presence.controller.js'

// Internal full-view only: a portal client holds `view_own_customer`, not these,
// so clients neither announce nor observe presence. Presence is a staff cue.
const internalViewers = requirePermissions('emotive_claims.view', 'domace_claims.view')

export function registerPresenceRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createPresenceController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.post('/heartbeat', internalViewers, controller.heartbeat)
  routes.post('/leave', internalViewers, controller.leave)

  app.route('/api/presence', routes)
}
