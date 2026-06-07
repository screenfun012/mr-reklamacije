import { m } from '@mr/i18n'

/** Extract TOTP shared secret from an `otpauth://` provisioning URI (manual entry). */
export function parseSecretFromTotpURI(uri: string): string {
  try {
    const u = new URL(uri)
    return u.searchParams.get('secret') ?? ''
  } catch {
    return ''
  }
}

/** Download backup codes as a plain-text file in the browser. */
export function downloadBackupCodes(codes: readonly string[], filename: string): void {
  if (typeof document === 'undefined') {
    return
  }
  const text = codes.join('\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function formatTwoFactorClientError(err: { code?: string } | undefined | null): string {
  const code = err?.code
  if (code === 'INVALID_CODE' || code === 'TOTP_NOT_ENABLED') {
    return m.auth_login_2fa_invalid_code()
  }
  if (code === 'INVALID_BACKUP_CODE' || code === 'BACKUP_CODES_NOT_ENABLED') {
    return m.auth_login_2fa_invalid_backup()
  }
  return m.auth_login_2fa_invalid_code()
}

function isTwoFactorSessionExpiredError(
  err: { code?: string; status?: number } | undefined | null,
): boolean {
  if (!err) return false
  if (err.status === 401) return true
  return err.code === 'INVALID_TWO_FACTOR_COOKIE'
}

export function messageForTotpVerifyFailure(
  err: { code?: string; status?: number } | undefined | null,
): string {
  if (isTwoFactorSessionExpiredError(err)) {
    return m.auth_login_2fa_session_expired()
  }
  return formatTwoFactorClientError(err)
}

export function messageForBackupVerifyFailure(
  err: { code?: string; status?: number } | undefined | null,
): string {
  if (isTwoFactorSessionExpiredError(err)) {
    return m.auth_login_2fa_session_expired()
  }
  const code = err?.code
  if (code === 'INVALID_BACKUP_CODE' || code === 'BACKUP_CODES_NOT_ENABLED') {
    return m.auth_login_2fa_invalid_backup()
  }
  return m.auth_login_2fa_invalid_backup()
}
