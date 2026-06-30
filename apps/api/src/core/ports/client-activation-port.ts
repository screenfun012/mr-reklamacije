import type { Locale } from '@mr/i18n'

export interface ActivatableUser {
  id: string
  email: string
  name: string
  preferredLanguage: Locale
}

export interface ClientActivationPort {
  /** Mint a token + email the activation link. Resolves to whether the email was sent. */
  sendActivationFor(user: ActivatableUser): Promise<boolean>
}
