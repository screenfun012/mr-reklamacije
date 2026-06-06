import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import type { Container } from '../../core/container.js'
import { createSseController } from './sse.controller.js'

export function registerEventsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createSseController(container)

  app.get('/api/events/me', controller.streamMe)
}
