import { INTERNAL_APP_PERMISSIONS } from '@mr/shared'
import { Hono } from 'hono'

import { requirePermissions } from '../../core/auth/require-permissions.js'
import type { Container } from '../../core/container.js'
import type { AppVariables } from '../../app.js'
import { createChatController } from './chat.controller.js'

export function registerChatRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createChatController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  /**
   * One gate for the whole module: whoever may enter the internal app may talk in it (spec N4 —
   * no new permission). A portal client holds none of these, so he is refused at the door; which
   * conversations an internal actor then sees is the service's business.
   */
  routes.use('*', requirePermissions(...INTERNAL_APP_PERMISSIONS))

  routes.get('/conversations', controller.listConversations)
  routes.get('/conversations/:id/messages', controller.listMessages)
  routes.post('/conversations/:id/messages', controller.sendMessage)

  app.route('/api/chat', routes)
}
