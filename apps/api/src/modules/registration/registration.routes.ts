import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import type { Container } from '../../core/container.js'
import { createRegistrationController } from './registration.controller.js'

export function registerRegistrationRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createRegistrationController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.post('/', controller.register)

  app.route('/api/registration', routes)
}
