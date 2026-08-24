import { INTERNAL_APP_PERMISSIONS } from '@mr/shared'
import type { Hono } from 'hono'

import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'

import { createPushController } from './push.controller.js'

/**
 * ⚠ The same door as the chat itself, and no new permission.
 *
 * A phone is told about chat messages, so whoever may not be in the chat has nothing to subscribe
 * to. A portal client holds none of `INTERNAL_APP_PERMISSIONS` and is refused here rather than
 * being allowed to register a device the fan-out would then have to remember to skip.
 */
export function registerPushRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createPushController(container)
  const routes = app.basePath('/api/push')

  routes.use('*', requirePermissions(...INTERNAL_APP_PERMISSIONS))

  routes.get('/public-key', controller.publicKey)
  routes.get('/devices', controller.listDevices)
  routes.post('/devices', controller.subscribe)
  routes.patch('/mode', controller.setMode)
  routes.delete('/devices/:id', controller.removeDevice)
}
