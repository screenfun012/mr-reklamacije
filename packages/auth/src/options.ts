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
