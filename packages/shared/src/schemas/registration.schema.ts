import { z } from 'zod'

/**
 * Portal client self-registration input. Passwordless: the client provides only
 * identity + a free-text company name (a hint the admin reads when linking the
 * real customer at approval). The password is set later via activation/reset.
 */
export const ClientRegistrationInputSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().min(1).max(200),
  companyName: z.string().trim().min(1).max(200),
})

export type ClientRegistrationInput = z.infer<typeof ClientRegistrationInputSchema>
