import { Hono } from 'hono'

import type { AppVariables } from '../../app.js'
import { requirePermission } from '../../core/auth/require-permission.js'
import type { Container } from '../../core/container.js'
import { createAppSettingsController } from './app-settings.controller.js'

export function registerAppSettingsRoutes(
  app: Hono<{ Variables: AppVariables }>,
  container: Container,
): void {
  const controller = createAppSettingsController(container)
  const routes = new Hono<{ Variables: AppVariables }>()

  routes.get('/', requirePermission('settings.app_settings.view'), controller.list)
  routes.patch('/', requirePermission('settings.app_settings.update'), controller.update)

  app.route('/api/app-settings', routes)
}
