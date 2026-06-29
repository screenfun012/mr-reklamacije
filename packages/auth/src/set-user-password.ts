import type { Auth } from './better-auth.config.js'

const CREDENTIAL_PROVIDER_ID = 'credential'

/**
 * Hashes and stores a new password for the given user via Better-Auth's own
 * context (same primitives the admin plugin uses internally:
 * `ctx.password.hash` + `ctx.internalAdapter`).
 *
 * `updatePassword` only UPDATEs an existing credential account, so if the user
 * has none yet we create one (matching the documented admin-plugin behaviour)
 * instead of silently doing nothing.
 *
 * This does NOT revoke sessions — callers must revoke separately (see
 * `revokeUserSessions`) so an admin-initiated reset forces re-login.
 */
export async function setUserPassword(
  auth: Auth,
  userId: string,
  newPassword: string,
): Promise<void> {
  const ctx = await auth.$context
  const hashedPassword = await ctx.password.hash(newPassword)

  const accounts = await ctx.internalAdapter.findAccounts(userId)
  const hasCredentialAccount = accounts.some(
    (account) => account.providerId === CREDENTIAL_PROVIDER_ID,
  )

  if (hasCredentialAccount) {
    await ctx.internalAdapter.updatePassword(userId, hashedPassword)
    return
  }

  await ctx.internalAdapter.createAccount({
    userId,
    accountId: userId,
    providerId: CREDENTIAL_PROVIDER_ID,
    password: hashedPassword,
  })
}
