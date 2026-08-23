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
  routes.post('/conversations/:id/read', controller.markRead)
  routes.post('/claims/:kind/:id/thread', controller.openClaimThread)

  routes.patch('/messages/:id', controller.editMessage)
  routes.delete('/messages/:id', controller.deleteMessage)
  routes.post('/conversations/:id/mute', controller.mute)
  routes.delete('/conversations/:id/mute', controller.unmute)
  routes.post('/messages/:id/pin', controller.pin)
  routes.delete('/messages/:id/pin', controller.unpin)
  routes.post('/messages/:id/reaction', controller.react)
  routes.delete('/messages/:id/reaction', controller.unreact)

  app.route('/api/chat', routes)
}
