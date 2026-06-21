import { z } from 'zod'

export const MrRegistryLookupQuerySchema = z.object({
  mr: z.string().min(1),
})

export type MrRegistryLookupQuery = z.infer<typeof MrRegistryLookupQuerySchema>
