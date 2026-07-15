import { schema } from '@mr/db'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { betterAuth, type Auth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { customSession } from 'better-auth/plugins'

import { createForcePendingOnSignupHook } from './hooks/force-pending-on-signup.js'
import { createLoginLockoutHooks } from './hooks/login-lockout.js'
import { createOnUserRegisteredHook } from './hooks/on-user-registered.js'
import { createSessionCreateAfterHook } from './hooks/session-create-after.js'
import { createSessionCreateBeforeHook } from './hooks/session-create-before.js'
import { createLoginAttemptStore } from './login-attempt-store.js'
import { sharedAuthOptions } from './options.js'
import { createPermissionResolver } from './permissions.js'
import { createCachedPermissionResolver } from './server/permission-cache.js'

export type { Auth }

export interface CreateAuthOptions {
  /**
   * Origins allowed to make cross-origin requests against this auth instance.
   * Required whenever the API is served from a different origin than the
   * frontend (the normal case in dev — api :3000, admin-web :3001, etc.).
   *
   * Parsed from env.PUBLIC_ORIGINS by the caller (e.g. apps/api). Passed as
   * an array here so the auth package does not need to know how the env
   * variable is parsed.
   */
  trustedOrigins?: string[]
  /** Called after a new pending user row is created (email signup). */
  onUserRegistered?: (userId: string) => void
}

/**
 * Factory for Better-Auth runtime instance. Consumers (e.g. apps/api)
 * create their own db instance and pass it in.
 *
 * Schema mapping uses explicit modelName → Drizzle table keys because
 * our Drizzle tables are named camelCase (verificationTokens) while
 * Better-Auth modelName is snake_case (verification_tokens).
 *
 * camelCase: true tells drizzleAdapter that Drizzle column properties
 * are camelCase (our convention), so BA-internal camelCase field
 * lookups match.
 *
 * TODO(apps/api): add session timeouts (per-role idle), cookie name
 * customization (`mrr.session_token`). Default cookie attributes live in shared `options.ts`.
 */
export function createAuth(db: NodePgDatabase<typeof schema>, opts: CreateAuthOptions = {}): Auth {
  const trustedOrigins = opts.trustedOrigins ?? []
  if (
    trustedOrigins.length === 0 &&
    process.env['NODE_ENV'] !== 'production' &&
    process.env['NODE_ENV'] !== 'test'
  ) {
    console.warn(
      '[@mr/auth] createAuth called without trustedOrigins — cross-origin requests may be rejected by Better-Auth origin validation',
    )
  }

  const { plugins: sharedPlugins = [], ...sharedWithoutPlugins } = sharedAuthOptions
  const resolver = createPermissionResolver(db)

  // Per-account (email-keyed) login lockout — brute-force protection that does
  // NOT collateral-block accounts sharing an IP. In-memory (single instance).
  const loginAttempts = createLoginAttemptStore()
  const loginLockout = createLoginLockoutHooks(loginAttempts)

  const cachedByRoles = createCachedPermissionResolver({
    resolveForRoles: async (roleCodes) =>
      resolver.getEffectiveForRoleCodes(roleCodes).then((p) => p.map(String)),
  })

  return betterAuth({
    // apps/api parses BETTER_AUTH_SECRET via env.ts (min length 32) before bootstrap.
    secret: process.env['BETTER_AUTH_SECRET'] ?? 'dev-only-change-me',
    baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000',
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      camelCase: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verification_tokens: schema.verificationTokens,
        two_factor_secrets: schema.twoFactorSecrets,
      },
    }),
    databaseHooks: {
      user: {
        create: {
          before: createForcePendingOnSignupHook(),
          after: createOnUserRegisteredHook(opts.onUserRegistered),
        },
      },
      session: {
        create: {
          before: createSessionCreateBeforeHook(db),
          after: createSessionCreateAfterHook(db),
        },
      },
    },
    hooks: {
      before: loginLockout.before,
      after: loginLockout.after,
    },
    ...sharedWithoutPlugins,
    plugins: [
      ...sharedPlugins,
      customSession(async ({ user, session }) => {
        const roleRows = await db
          .select({ code: schema.roles.code })
          .from(schema.userRoles)
          .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
          .where(eq(schema.userRoles.userId, user.id))

        const roleCodes = roleRows.map((r) => r.code)
        const permissions = await cachedByRoles.resolveForRoles(roleCodes)

        return {
          // The raw session token is intentionally omitted — it belongs only in
          // the httpOnly cookie, never in this JS-readable JSON body.
          session: {
            id: session.id,
            userId: session.userId,
            expiresAt: session.expiresAt,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
          },
          user: {
            ...user,
            roles: roleCodes,
            permissions,
          },
        }
      }),
    ],
  }) as unknown as Auth
}
