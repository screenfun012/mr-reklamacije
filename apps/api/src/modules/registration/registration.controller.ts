import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { ClientRegistrationInputSchema } from './registration.validators.js'

export function createRegistrationController(container: Container) {
  return {
    register: async (c: Context) => {
      const body: unknown = await c.req.json()
      const input = ClientRegistrationInputSchema.parse(body)
      await container.registrationService.register(input)

      // 202 Accepted: the registration was received and is pending admin approval.
      // The response is intentionally neutral (no body) — it never reveals whether
      // the email already had an account.
      return c.body(null, 202)
    },
  }
}
