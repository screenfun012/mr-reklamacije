import { z } from 'zod'

export {
  IntakeChecklistItemCreateInputSchema,
  IntakeChecklistItemListItemSchema,
  IntakeChecklistItemsListQuerySchema,
  IntakeChecklistItemUpdateInputSchema,
  type IntakeChecklistItemCreateInput,
  type IntakeChecklistItemListItem,
  type IntakeChecklistItemsListQuery,
  type IntakeChecklistItemUpdateInput,
  type ReferenceListResponse,
} from '@mr/shared'

export const IntakeChecklistItemIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type IntakeChecklistItemIdParam = z.infer<typeof IntakeChecklistItemIdParamSchema>
