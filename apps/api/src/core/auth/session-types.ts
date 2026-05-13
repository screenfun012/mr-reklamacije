import type { Auth } from '@mr/auth'

/**
 * Resolved session + user payload from Better-Auth `getSession` (including
 * customSession-enriched fields on `user`).
 */
export type BetterAuthFullSession = NonNullable<Awaited<ReturnType<Auth['api']['getSession']>>>

/** User placed on Hono context; `roles` / `permissions` come from customSession at runtime. */
export type MRSessionUser = NonNullable<BetterAuthFullSession['user']> & {
  roles: string[]
  permissions: string[]
}
