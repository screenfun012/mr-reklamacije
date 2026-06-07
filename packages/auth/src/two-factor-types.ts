import type { MRAuthClientForPermissions } from './auth-client-types.js'

/** Better-Auth two-factor mutation response shape (narrow subset for UI). */
export type TwoFactorMutationResult = {
  data?: {
    status?: boolean
    totpURI?: string
    backupCodes?: string[]
    token?: string
    user?: unknown
    [key: string]: unknown
  } | null
  error?: {
    code?: string
    message?: string
    /** HTTP status when Better Fetch surfaces it (e.g. 401 = missing/invalid 2FA pending cookie). */
    status?: number
  } | null
}

export type MRAuthClientTwoFactorApi = {
  enable: (input: { password: string }) => Promise<TwoFactorMutationResult>
  verifyTotp: (input: { code: string; trustDevice?: boolean }) => Promise<TwoFactorMutationResult>
  verifyBackupCode: (input: {
    code: string
    trustDevice?: boolean
  }) => Promise<TwoFactorMutationResult>
  disable: (input: { password: string }) => Promise<TwoFactorMutationResult>
}

/**
 * Auth client with Better-Auth two-factor plugin methods (see `twoFactorClient()`
 * in `@mr/auth/client` presets). Runtime includes `twoFactor` when the plugin is
 * enabled; generated client typings may omit it, so the property is optional here.
 */
export type MRAuthClientWithTwoFactor = MRAuthClientForPermissions & {
  twoFactor?: MRAuthClientTwoFactorApi
  getSession?: () => Promise<unknown>
}
