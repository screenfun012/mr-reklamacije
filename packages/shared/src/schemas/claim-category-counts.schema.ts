import { z } from 'zod'

/**
 * Pending/total per category for the reader's OWN scope — what the sidebar badges, the list
 * header and the "Ugašene" filter group read (V2 spec §4.4). A category appears when it is
 * active OR still carries claims the reader may see; a retired, empty one is nobody's business.
 */
export const ClaimCategoryCountSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  total: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
})

export type ClaimCategoryCount = z.infer<typeof ClaimCategoryCountSchema>

export const ClaimCategoryCountsResponseSchema = z.object({
  items: z.array(ClaimCategoryCountSchema),
  totals: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  }),
})

export type ClaimCategoryCountsResponse = z.infer<typeof ClaimCategoryCountsResponseSchema>
