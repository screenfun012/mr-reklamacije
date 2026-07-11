import path from 'node:path'

import type { Logger } from '@mr/logger'
import { PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT, type Permission } from '@mr/shared'
import { Hono } from 'hono'
import { vi } from 'vitest'

import type { AppVariables } from '../app.js'
import type { MRSessionUser } from '../core/auth/session-types.js'
import { buildContainer, type Container } from '../core/container.js'
import type { Env } from '../config/env.js'
import { registerGlobalErrorHandler } from '../core/middleware/error-handler.js'
import { createSignupOriginGuard } from '../core/middleware/signup-origin-guard.js'
import type { EmailPort } from '../core/ports/email-port.js'
import { registerRegistrationRoutes } from '../modules/registration/index.js'
import { registerActivationRoutes } from '../modules/activation/index.js'
import { registerAttachmentsRoutes } from '../modules/attachments/index.js'
import { registerAuditLogRoutes } from '../modules/audit/index.js'
import { registerClaimReportsRoutes } from '../modules/claim-reports/index.js'
import { registerExcelRoutes } from '../modules/excel/index.js'
import { registerStatisticsRoutes } from '../modules/statistics/index.js'
import { registerClaimSourcesRoutes } from '../modules/claim-sources/index.js'
import { registerCustomersRoutes } from '../modules/customers/index.js'
import { registerUsersRoutes } from '../modules/users/index.js'
import { registerDepartmentsRoutes } from '../modules/departments/index.js'
import { registerDomaceClaimsRoutes } from '../modules/domace-claims/index.js'
import { registerEmployeesRoutes } from '../modules/employees/index.js'
import { registerEmotiveClaimsRoutes } from '../modules/emotive-claims/index.js'
import { registerClaimsRoutes } from '../modules/claims/index.js'
import { registerDashboardRoutes } from '../modules/dashboard/index.js'
import { registerEngineTypesRoutes } from '../modules/engine-types/index.js'
import { registerEngineManufacturersRoutes } from '../modules/engine-manufacturers/index.js'
import type { EventBus } from '../modules/events/index.js'
import { registerExternalPartiesRoutes } from '../modules/external-parties/index.js'
import { TEST_USER_ID } from './fixtures.js'

export function createTestEnv(databaseUrl: string): Env {
  return {
    NODE_ENV: 'test',
    LOG_LEVEL: 'error',
    TZ: 'Europe/Belgrade',
    PORT: 3000,
    HOST: '127.0.0.1',
    API_BASE_URL: 'http://127.0.0.1:3000',
    API_REPLICA_COUNT: 1,
    PUBLIC_ORIGINS: ['http://127.0.0.1:5173'],
    SELF_SIGNUP_ORIGINS: ['http://127.0.0.1:3002'],
    CLIENT_SIGNUP_ORIGINS: ['http://127.0.0.1:3003'],
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: 'test-secret-minimum-32-characters-long',
    BETTER_AUTH_URL: 'http://127.0.0.1:3000',
    PROTECTED_SUPER_ADMIN_EMAIL: PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
    SESSION_IDLE_ADMIN_MIN: 30,
    SESSION_IDLE_OPERATOR_MIN: 240,
    SESSION_IDLE_VIEWER_MIN: 240,
    SESSION_IDLE_CLIENT_MIN: 43200,
    OPENAI_MODEL: 'gpt-4o-mini',
    OPENAI_MAX_TOKENS_PER_REQUEST: 2000,
    UPLOAD_DIR: path.join(process.cwd(), '.tmp', 'test-uploads'),
    S3_REGION: 'us-east-1',
    S3_FORCE_PATH_STYLE: true,
    CLAIM_REPORT_PDF_ENABLED: true,
  }
}

export function fakeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  } as unknown as Logger
}

export function testUser(
  permissions: Permission[],
  id = TEST_USER_ID,
  roles: string[] = ['operator'],
): MRSessionUser {
  return {
    id,
    roles,
    permissions,
  } as MRSessionUser
}

export function createEmotiveClaimsTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerEmotiveClaimsRoutes(app, container)

  return app
}

export function createReferenceTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerEmployeesRoutes(app, container)
  registerEngineTypesRoutes(app, container)
  registerEngineManufacturersRoutes(app, container)
  registerExternalPartiesRoutes(app, container)
  registerCustomersRoutes(app, container)
  registerUsersRoutes(app, container)
  registerClaimSourcesRoutes(app, container)
  registerDepartmentsRoutes(app, container)
  registerEmotiveClaimsRoutes(app, container)

  return app
}

export function createAttachmentsTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerAttachmentsRoutes(app, container)
  registerDomaceClaimsRoutes(app, container)
  registerEmotiveClaimsRoutes(app, container)

  return app
}

export function createClaimReportsTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerClaimReportsRoutes(app, container)
  registerDomaceClaimsRoutes(app, container)
  registerEmotiveClaimsRoutes(app, container)

  return app
}

export function createExcelTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerExcelRoutes(app, container)
  registerDomaceClaimsRoutes(app, container)
  registerEmotiveClaimsRoutes(app, container)

  return app
}

export function createStatisticsTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerStatisticsRoutes(app, container)
  registerDomaceClaimsRoutes(app, container)
  registerEmotiveClaimsRoutes(app, container)

  return app
}

export function createUsersTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerUsersRoutes(app, container)

  return app
}

export function createRegistrationTestApp(container: Container): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  // Mirror the production middleware for this public route: the portal-origin
  // guard runs before the handler (rate limiting is verified separately).
  app.use('/api/registration', createSignupOriginGuard(container.env.CLIENT_SIGNUP_ORIGINS))

  registerRegistrationRoutes(app, container)

  return app
}

export function createActivationTestApp(container: Container): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('/api/activation', createSignupOriginGuard(container.env.CLIENT_SIGNUP_ORIGINS))

  registerActivationRoutes(app, container)

  return app
}

export function createClaimsTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerClaimsRoutes(app, container)

  return app
}

export function createDashboardTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerDashboardRoutes(app, container)

  return app
}

export function createAuditLogTestApp(
  container: Container,
  user: MRSessionUser | null,
): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()
  registerGlobalErrorHandler(app, container.logger)

  app.use('*', async (c, next) => {
    c.set('user', user)
    c.set('session', null)
    await next()
  })

  registerAuditLogRoutes(app, container)

  return app
}

export function buildTestContainer(
  db: Container['db'],
  pool: Container['pool'],
  databaseUrl: string,
  eventBus?: EventBus,
  emailPort?: EmailPort,
): Container {
  return buildContainer(createTestEnv(databaseUrl), fakeLogger(), db, pool, eventBus, emailPort)
}
