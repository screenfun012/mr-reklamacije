import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'

import type { Container } from './core/container.js'
import { requireAuth } from './core/auth/require-auth.js'
import { createSessionMiddleware } from './core/auth/session-middleware.js'
import type { BetterAuthFullSession, MRSessionUser } from './core/auth/session-types.js'
import { requestBodyLimit } from './core/middleware/body-limit.js'
import { registerGlobalErrorHandler } from './core/middleware/error-handler.js'
import {
  activationRateLimiter,
  clientRegistrationRateLimiter,
  generalRateLimiter,
  loginRateLimiter,
  signupRateLimiter,
} from './core/middleware/rate-limit.js'
import { createSignupOriginGuard } from './core/middleware/signup-origin-guard.js'
import { createRequestLogger } from './core/middleware/request-logger.js'
import { registerPresenceRoutes } from './modules/presence/index.js'
import { registerHealthRoutes } from './routes/health.js'
import { registerAuditLogRoutes } from './modules/audit/index.js'
import { registerClaimSourcesRoutes } from './modules/claim-sources/index.js'
import { registerCustomersRoutes } from './modules/customers/index.js'
import { registerUsersRoutes } from './modules/users/index.js'
import { registerRegistrationRoutes } from './modules/registration/index.js'
import { registerActivationRoutes } from './modules/activation/index.js'
import { registerDepartmentsRoutes } from './modules/departments/index.js'
import { registerClaimsRoutes } from './modules/claims/index.js'
import { registerDashboardRoutes } from './modules/dashboard/index.js'
import { registerDomaceClaimsRoutes } from './modules/domace-claims/index.js'
import { registerEmployeesRoutes } from './modules/employees/index.js'
import { registerEmotiveClaimsRoutes } from './modules/emotive-claims/index.js'
import { registerClientSubmissionsRoutes } from './modules/client-submissions/index.js'
import { registerEngineTypesRoutes } from './modules/engine-types/index.js'
import { registerEngineManufacturersRoutes } from './modules/engine-manufacturers/index.js'
import { registerEventsRoutes } from './modules/events/index.js'
import { registerExternalPartiesRoutes } from './modules/external-parties/index.js'
import { registerAttachmentsRoutes } from './modules/attachments/index.js'
import { registerClaimReportsRoutes } from './modules/claim-reports/index.js'
import { registerExcelRoutes } from './modules/excel/index.js'
import { registerStatisticsRoutes } from './modules/statistics/index.js'
import { registerMrRegistryRoutes } from './modules/mr-registry/index.js'
import { registerNotificationsRoutes } from './modules/notifications/index.js'

export type { MRSessionUser }

export type AppVariables = {
  user: MRSessionUser | null
  session: BetterAuthFullSession['session'] | null
}

function isPublicPath(path: string): boolean {
  if (path.startsWith('/api/auth')) {
    return true
  }
  if (path === '/health' || path === '/api/health') {
    return true
  }
  if (path === '/api/attachments/raw') {
    return true
  }
  if (path === '/api/registration') {
    return true
  }
  if (path === '/api/activation') {
    return true
  }
  return false
}

/**
 * Security response headers for every API response (JSON, streamed files, errors).
 *
 * The API serves JSON and streamed file bytes — never an HTML app — so the CSP is
 * locked to `default-src 'none'`. `frame-ancestors 'self'` (NOT `'none'`) and
 * `X-Frame-Options: SAMEORIGIN` are deliberate: internal-web embeds inline PDF /
 * document attachments (`/api/attachments/:id/download`) in a same-origin `<iframe>`
 * preview, which `'none'` / `DENY` would block. `'self'` still blocks ALL
 * cross-origin framing, which is the actual clickjacking threat.
 *
 * Installed as the outermost middleware so its post-`next()` pass sets headers on
 * the final response of every request, including `app.onError` error responses
 * (Hono's compose resolves the handled error upward, so this pass still runs).
 */
const apiSecureHeaders = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    frameAncestors: ["'self'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
  },
  xFrameOptions: 'SAMEORIGIN',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
})

/**
 * Hono app factory. Middleware order (outer to inner):
 * 1. registerGlobalErrorHandler (app.onError)
 * 2. Secure headers (outermost — covers every response, incl. errors)
 * 3. Request logger
 * 4. General rate limiter
 * 5. Login rate limiter (sign-in email only)
 * 6. Session middleware
 * 7. Global requireAuth with opt-out for public prefixes (auth + health)
 * 8. Better-Auth `/api/auth/*`
 * 9. Routes (health, future modules)
 */
export function createApp(container: Container): Hono<{ Variables: AppVariables }> {
  const app = new Hono<{ Variables: AppVariables }>()

  registerGlobalErrorHandler(app, container.logger)
  app.use('*', apiSecureHeaders)
  app.use('*', createRequestLogger(container.logger))
  app.use('*', requestBodyLimit)
  app.use('*', generalRateLimiter)
  app.use('/api/auth/sign-in/email', loginRateLimiter)
  app.use('/api/auth/sign-up/email', signupRateLimiter)
  app.use('/api/auth/sign-up/email', createSignupOriginGuard(container.env.SELF_SIGNUP_ORIGINS))
  app.use('/api/registration', clientRegistrationRateLimiter)
  app.use('/api/registration', createSignupOriginGuard(container.env.CLIENT_SIGNUP_ORIGINS))
  app.use('/api/activation', activationRateLimiter)
  app.use('/api/activation', createSignupOriginGuard(container.env.CLIENT_SIGNUP_ORIGINS))
  app.use('*', createSessionMiddleware(container.auth))

  app.use('*', async (c, next) => {
    if (isPublicPath(c.req.path)) {
      return next()
    }
    return requireAuth()(c, next)
  })

  app.on(['POST', 'GET'], '/api/auth/*', (c) => container.auth.handler(c.req.raw))

  registerHealthRoutes(app)

  registerEmployeesRoutes(app, container)
  registerEngineTypesRoutes(app, container)
  registerEngineManufacturersRoutes(app, container)
  registerExternalPartiesRoutes(app, container)
  registerCustomersRoutes(app, container)
  registerUsersRoutes(app, container)
  registerRegistrationRoutes(app, container)
  registerActivationRoutes(app, container)
  registerAuditLogRoutes(app, container)
  registerClaimSourcesRoutes(app, container)
  registerDepartmentsRoutes(app, container)
  registerEmotiveClaimsRoutes(app, container)
  registerClientSubmissionsRoutes(app, container)
  registerPresenceRoutes(app, container)
  registerDomaceClaimsRoutes(app, container)
  registerMrRegistryRoutes(app, container)
  registerClaimsRoutes(app, container)
  registerDashboardRoutes(app, container)
  registerStatisticsRoutes(app, container)
  registerAttachmentsRoutes(app, container)
  registerClaimReportsRoutes(app, container)
  registerExcelRoutes(app, container)
  registerNotificationsRoutes(app, container)
  registerEventsRoutes(app, container)

  return app
}
