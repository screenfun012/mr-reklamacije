import type { Context } from 'hono'

import type { Container } from '../../core/container.js'
import { ActivationCompleteInputSchema } from './activation.validators.js'

export function createActivationController(container: Container) {
  return {
    complete: async (c: Context) => {
      const body: unknown = await c.req.json()
      const input = ActivationCompleteInputSchema.parse(body)
      await container.activationService.completeActivation(input)

      return c.body(null, 204)
    },
  }
}
