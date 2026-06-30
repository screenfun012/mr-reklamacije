import { PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT } from '@mr/shared'
import { z } from 'zod'

const EnvSchema = z.object({
  // Common
  NODE_ENV: z.enum(['development', 'production', 'staging', 'test']),
  LOG_LEVEL: z.string().default('info'),
  TZ: z.string().default('Europe/Belgrade'),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  API_BASE_URL: z.url(),
  PUBLIC_ORIGINS: z.string().transform((s) =>
    s
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  ),
  /** Origins allowed to call POST /api/auth/sign-up/email (internal-web self-signup). */
  SELF_SIGNUP_ORIGINS: z
    .string()
    .default('http://localhost:3002')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  /** Origins allowed to call POST /api/registration (portal client self-registration). */
  CLIENT_SIGNUP_ORIGINS: z
    .string()
    .default('http://localhost:3003')
    .transform((s) =>
      s
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  // Database
  DATABASE_URL: z.string().min(1),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32, {
    error: 'BETTER_AUTH_SECRET must be at least 32 characters',
  }),
  BETTER_AUTH_URL: z.url(),
  /**
   * Dedicated HMAC secret for signing attachment download URLs (defense in depth).
   * Optional: when unset, signing falls back to BETTER_AUTH_SECRET, so behaviour is
   * unchanged until this is provided. Introducing/rotating it invalidates any
   * outstanding signed attachment URLs — negligible, since their TTL is 5 minutes.
   */
  ATTACHMENT_SIGNING_SECRET: z.string().min(32).optional(),
  /** Protected super-admin account — role/status changes are always rejected server-side. */
  PROTECTED_SUPER_ADMIN_EMAIL: z.string().email().default(PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT),

  // Sessions
  SESSION_IDLE_ADMIN_MIN: z.coerce.number().int().positive().default(30),
  SESSION_IDLE_OPERATOR_MIN: z.coerce.number().int().positive().default(240),
  SESSION_IDLE_VIEWER_MIN: z.coerce.number().int().positive().default(240),
  SESSION_IDLE_CLIENT_MIN: z.coerce.number().int().positive().default(43200),

  // OpenAI (optional in Phase 0)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS_PER_REQUEST: z.coerce.number().int().positive().default(2000),

  // File uploads (Railway volume in production; local path in dev)
  UPLOAD_DIR: z.string().min(1).default('./data/uploads'),

  // Claim report PDF export (Playwright). When false, API returns 503 and UI falls back to print.
  CLAIM_REPORT_PDF_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
})

export type Env = z.infer<typeof EnvSchema>

export function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(`Environment validation failed:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
