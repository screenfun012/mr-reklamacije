import { z } from 'zod'

export {
  IntakeChecklistItemCreateInputSchema,
  IntakeChecklistItemListItemSchema,
  IntakeChecklistItemUpdateInputSchema,
  ReferenceListQuerySchema,
  type IntakeChecklistItemCreateInput,
  type IntakeChecklistItemListItem,
  type IntakeChecklistItemUpdateInput,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const IntakeChecklistItemIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type IntakeChecklistItemIdParam = z.infer<typeof IntakeChecklistItemIdParamSchema>
