import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'

/**
 * Generate-only Better Auth options for `pnpm auth:generate`.
 * Do not import @mr/db here — CLI loads this file via jiti; keep it free of DATABASE_URL.
 * Use `--adapter drizzle` so the CLI uses a mock adapter and never instantiates drizzleAdapter.
 *
 * Named export `auth` is what Better Auth CLI expects (see packages/cli/src/utils/get-config.ts).
 */
export const auth = betterAuth({
  secret: 'generate-only-placeholder',
  baseURL: 'http://localhost:3000',
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
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
})
