import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import type { Container } from '../../core/container.js'
import { createActivationController } from './activation.controller.js'

export function registerActivationRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createActivationController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.post('/', controller.complete)

  app.route('/api/activation', routes)
}
