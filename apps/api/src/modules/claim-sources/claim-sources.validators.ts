import { z } from 'zod'

export {
  ClaimSourceCreateInputSchema,
  ClaimSourceListItemSchema,
  ClaimSourceUpdateInputSchema,
  ReferenceListQuerySchema,
  type ClaimSourceCreateInput,
  type ClaimSourceListItem,
  type ClaimSourceUpdateInput,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const ClaimSourceIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type ClaimSourceIdParam = z.infer<typeof ClaimSourceIdParamSchema>
