import { z } from 'zod'

export {
  ClaimCategoryFieldCreateInputSchema,
  ClaimCategoryFieldListItemSchema,
  ClaimCategoryFieldUpdateInputSchema,
  ClaimCategoryFieldsListQuerySchema,
  type ClaimCategoryFieldCreateInput,
  type ClaimCategoryFieldListItem,
  type ClaimCategoryFieldOptionListItem,
  type ClaimCategoryFieldType,
  type ClaimCategoryFieldUpdateInput,
  type ClaimCategoryFieldsListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const ClaimCategoryFieldIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type ClaimCategoryFieldIdParam = z.infer<typeof ClaimCategoryFieldIdParamSchema>
