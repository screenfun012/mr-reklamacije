import type { Auth } from 'better-auth'
import { betterAuth } from 'better-auth'

import { sharedAuthOptions } from './options.js'

/**
 * Generate-only Better Auth options for `pnpm auth:generate`.
 * Do not import @mr/db here — CLI loads this file via jiti; keep it free of DATABASE_URL.
 * Use `--adapter drizzle` so the CLI uses a mock adapter and never instantiates drizzleAdapter.
 *
 * Named export `auth` is what Better Auth CLI expects (see packages/cli/src/utils/get-config.ts).
 */
export const auth: Auth = betterAuth({
  secret: 'generate-only-placeholder',
  baseURL: 'http://localhost:3000',
  ...sharedAuthOptions,
}) as Auth
