import { z } from 'zod'

import { PasswordSchema } from './user.schema.js'

/** Portal activation completion: a one-time token + the client's first password. */
export const ActivationCompleteInputSchema = z.object({
  token: z.string().min(1),
  newPassword: PasswordSchema,
})

export type ActivationCompleteInput = z.infer<typeof ActivationCompleteInputSchema>
