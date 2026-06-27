import type { Auth } from './better-auth.config.js'

/**
 * Invalidates every Better-Auth session for the given user so the next login
 * picks up fresh roles/permissions (bypasses customSession cache).
 */
export async function revokeUserSessions(auth: Auth, userId: string): Promise<void> {
  const ctx = await auth.$context
  await ctx.internalAdapter.deleteSessions(userId)
}
