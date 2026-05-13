import { schema } from '@mr/db'
import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { betterAuth, type Auth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { customSession } from 'better-auth/plugins'

import { createDeletedAtCheckHook } from './hooks/deleted-at-check.js'
import { createLoginAuditHook } from './hooks/login-audit.js'
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
 * customization (mrr.session_token), advanced cookie settings. Those
 * are runtime-specific and belong next to the API app.
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

  const cachedByRoles = createCachedPermissionResolver({
    resolveForRoles: async (roleCodes) =>
      resolver.getEffectiveForRoleCodes(roleCodes).then((p) => p.map(String)),
  })

  return betterAuth({
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
      session: {
        create: {
          before: createDeletedAtCheckHook(db),
          after: createLoginAuditHook(db),
        },
      },
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
          session,
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
