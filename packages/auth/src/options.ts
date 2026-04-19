import { twoFactor } from 'better-auth/plugins'

/**
 * Shared Better-Auth options used by both CLI generate config and
 * runtime config. Do not import database or environment here.
 */
export const sharedAuthOptions = {
  user: {
    modelName: 'users',
    additionalFields: {
      isActive: {
        type: 'boolean' as const,
        required: true,
        defaultValue: true,
        input: false,
      },
      preferredLanguage: {
        type: 'string' as const,
        required: true,
        defaultValue: 'sr',
        input: false,
      },
      deletedAt: {
        type: 'date' as const,
        required: false,
      },
      lastLoginAt: {
        type: 'date' as const,
        required: false,
      },
      lastLoginIp: {
        type: 'string' as const,
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
      generateId: 'uuid' as const,
    },
  },
}
