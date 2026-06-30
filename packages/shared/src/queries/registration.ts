import { fetchNoContent } from '../api/fetch-no-content.js'
import type { ClientRegistrationInput } from '../schemas/registration.schema.js'

/**
 * Submit a portal client self-registration. Always resolves on success without
 * revealing whether the email already had an account (neutral, anti-enumeration).
 */
export async function registerClient(input: ClientRegistrationInput): Promise<void> {
  await fetchNoContent('/api/registration', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}
