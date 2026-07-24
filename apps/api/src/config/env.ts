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
  // Number of API replicas this deploy runs. Realtime uses an in-process event
  // bus, so SSE only works within ONE instance; set this to match the deploy so
  // startup warns loudly (instead of failing silently) if replicas are scaled
  // up before a distributed bus (Postgres LISTEN/NOTIFY / Redis) is in place.
  API_REPLICA_COUNT: z.coerce.number().int().positive().default(1),
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

  // Object storage (MinIO/S3) for attachments. Set all four (endpoint, bucket, keys)
  // together to store attachments in S3 instead of UPLOAD_DIR — this removes the Railway
  // volume so the service deploys without downtime. Set none => local filesystem (dev/CI);
  // a partial set fails fast at boot (see create-storage-service).
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // Claim report PDF export (Playwright). When false, API returns 503 and UI falls back to print.
  CLAIM_REPORT_PDF_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // Transactional email (Resend) for client activation. Both optional: when either
  // is absent, email is disabled (NoOp) and the admin falls back to manual reset.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),

  // Redis (optional). When set, enables server-side caching (statistics/dashboard) and,
  // later, a shared rate-limiter/lockout store for multi-replica. Absent => every
  // Redis-backed feature falls back to in-memory/DB, so the app behaves exactly as today.
  // MUST be the PRIVATE Railway URL (redis.railway.internal) — the public TCP proxy bills egress.
  REDIS_URL: z.string().url().optional(),
})

export type Env = z.infer<typeof EnvSchema>

export function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(`Environment validation failed:\n${z.prettifyError(result.error)}`)
  }
  return result.data
}
