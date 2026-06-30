import { randomBytes } from 'node:crypto'

import type { Auth } from '@mr/auth'
import { eq } from 'drizzle-orm'

import type { ApiDatabase } from '../../core/database.js'
import { users } from './registration.schema.js'
import type { ClientRegistrationInput } from './registration.validators.js'

/**
 * Portal client self-registration. Passwordless from the client's perspective:
 * a strong random password is generated server-side (never revealed) so the user
 * row + credential exist, while login stays blocked until the account is approved
 * AND a real password is set via activation/reset. The pending status + SSE come
 * from Better-Auth's user-create hooks; here we only attach the company hint.
 */
export class RegistrationService {
  constructor(
    private readonly db: ApiDatabase,
    private readonly auth: Auth,
  ) {}

  async register(input: ClientRegistrationInput): Promise<void> {
    // Neutral anti-enumeration: if the email already has an account (citext is
    // case-insensitive), do nothing and let the caller return the same response.
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1)

    if (existing !== undefined) {
      return
    }

    const password = randomBytes(24).toString('base64url')

    let userId: string
    try {
      const result = await this.auth.api.signUpEmail({
        body: { email: input.email, password, name: input.name },
        headers: new Headers(),
      })
      userId = result?.user?.id ?? ''
    } catch {
      // Better-Auth rejects a duplicate email (concurrent registration race) —
      // stay neutral rather than surface that the account exists.
      return
    }

    if (userId === '') {
      return
    }

    await this.db
      .update(users)
      .set({ requestedCompany: input.companyName })
      .where(eq(users.id, userId))
  }
}
