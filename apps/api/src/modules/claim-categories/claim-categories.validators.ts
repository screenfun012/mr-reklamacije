import { z } from 'zod'

export {
  ClaimCategoryCreateInputSchema,
  ClaimCategoryListItemSchema,
  ClaimCategoryUpdateInputSchema,
  ReferenceListQuerySchema,
  type ClaimCategoryCreateInput,
  type ClaimCategoryListItem,
  type ClaimCategoryUpdateInput,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const ClaimCategoryIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type ClaimCategoryIdParam = z.infer<typeof ClaimCategoryIdParamSchema>
