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
  PUBLIC_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  // Database
  DATABASE_URL: z.string().min(1),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(32, {
    error: 'BETTER_AUTH_SECRET must be at least 32 characters',
  }),
  BETTER_AUTH_URL: z.url(),

  // Sessions
  SESSION_IDLE_ADMIN_MIN: z.coerce.number().int().positive().default(30),
  SESSION_IDLE_OPERATOR_MIN: z.coerce.number().int().positive().default(240),
  SESSION_IDLE_VIEWER_MIN: z.coerce.number().int().positive().default(240),
  SESSION_IDLE_CLIENT_MIN: z.coerce.number().int().positive().default(43200),

  // OpenAI (optional in Phase 0)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS_PER_REQUEST: z.coerce.number().int().positive().default(2000),
})

export type Env = z.infer<typeof EnvSchema>

export function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env)
  if (!result.success) {
    throw new Error(
      `Environment validation failed:\n${z.prettifyError(result.error)}`,
    )
  }
  return result.data
}
