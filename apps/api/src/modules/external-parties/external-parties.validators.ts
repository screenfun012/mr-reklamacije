import { z } from 'zod'

export {
  ExternalPartyCreateInputSchema,
  ExternalPartyListItemSchema,
  ExternalPartyUpdateInputSchema,
  ReferenceListQuerySchema,
  type ExternalPartyCreateInput,
  type ExternalPartyListItem,
  type ExternalPartyUpdateInput,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const ExternalPartyIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type ExternalPartyIdParam = z.infer<typeof ExternalPartyIdParamSchema>
