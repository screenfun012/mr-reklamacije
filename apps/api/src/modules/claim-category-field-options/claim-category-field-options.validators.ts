import { z } from 'zod'

export {
  ClaimCategoryFieldOptionCreateInputSchema,
  ClaimCategoryFieldOptionListItemSchema,
  ClaimCategoryFieldOptionUpdateInputSchema,
  ClaimCategoryFieldOptionsListQuerySchema,
  type ClaimCategoryFieldOptionCreateInput,
  type ClaimCategoryFieldOptionListItem,
  type ClaimCategoryFieldOptionUpdateInput,
  type ClaimCategoryFieldOptionsListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const ClaimCategoryFieldOptionIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type ClaimCategoryFieldOptionIdParam = z.infer<typeof ClaimCategoryFieldOptionIdParamSchema>
