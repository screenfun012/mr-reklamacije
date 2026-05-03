import type { BetterAuthOptions } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'

/**
 * Shared Better-Auth options used by both CLI generate config and
 * runtime config. Do not import database or environment here.
 */
export const sharedAuthOptions: BetterAuthOptions = {
  user: {
    modelName: 'users',
    additionalFields: {
      isActive: {
        type: 'boolean',
        required: true,
        defaultValue: true,
        input: false,
      },
      preferredLanguage: {
        type: 'string',
        required: true,
        defaultValue: 'sr',
        input: false,
      },
      deletedAt: {
        type: 'date',
        required: false,
      },
      lastLoginAt: {
        type: 'date',
        required: false,
      },
      lastLoginIp: {
        type: 'string',
        required: false,
      },
    },
  },
  session: {
    modelName: 'sessions',
  },
  account: {
    modelName: 'accounts',
  },
  verification: {
    modelName: 'verification_tokens',
  },
  // Email + password authentication.
  // minPasswordLength follows the strictest role from docs/05-auth-realtime.md
  // (admin: 12 chars). Complexity rules (upper/lower/digit/symbol) are enforced
  // separately through a custom validator; Better-Auth does not support
  // per-role length policies.
  // requireEmailVerification is false in dev; production toggles this via an
  // env-driven override or a separate prod config.
  // autoSignIn is false so programmatic signups (admin bootstrap script,
  // admin-created internal users) do not receive session tokens; the UI signup
  // flow handles login as a separate step.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    requireEmailVerification: false,
    autoSignIn: false,
  },
  plugins: [
    twoFactor({
      twoFactorTable: 'two_factor_secrets',
    }),
  ],
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
}
