/** Default super-admin email — override via PROTECTED_SUPER_ADMIN_EMAIL in apps/api env. */
export const PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT = 'screenfun99@gmail.com'

/**
 * Resolves the protected super-admin email.
 * API passes env-validated override; tests and browser code use the default.
 */
export function resolveProtectedSuperAdminEmail(override?: string | null | undefined): string {
  const trimmed = override?.trim()
  if (trimmed !== undefined && trimmed.length > 0) {
    return trimmed
  }
  return PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT
}

/** Case-insensitive match against the protected super-admin account. */
export function isProtectedSuperAdminEmail(
  email: string,
  protectedEmail: string = PROTECTED_SUPER_ADMIN_EMAIL_DEFAULT,
): boolean {
  return email.trim().toLowerCase() === protectedEmail.trim().toLowerCase()
}
