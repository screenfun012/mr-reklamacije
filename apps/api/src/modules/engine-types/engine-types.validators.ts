import { z } from 'zod'

export {
  EngineTypeCreateInputSchema,
  EngineTypeListItemSchema,
  EngineTypeUpdateInputSchema,
  ReferenceListQuerySchema,
  type EngineTypeCreateInput,
  type EngineTypeListItem,
  type EngineTypeUpdateInput,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const EngineTypeIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type EngineTypeIdParam = z.infer<typeof EngineTypeIdParamSchema>
