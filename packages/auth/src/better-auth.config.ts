import { schema } from '@mr/db'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { betterAuth, type Auth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { createDeletedAtCheckHook } from './hooks/deleted-at-check.js'
import { createLoginAuditHook } from './hooks/login-audit.js'
import { sharedAuthOptions } from './options.js'

export type { Auth }

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
export function createAuth(db: NodePgDatabase<typeof schema>): Auth {
  return betterAuth({
    secret: process.env['BETTER_AUTH_SECRET'] ?? 'dev-only-change-me',
    baseURL: process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000',
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
    ...sharedAuthOptions,
  }) as Auth
}
