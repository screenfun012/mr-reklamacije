import { z } from 'zod'

export {
  EngineTypeCreateInputSchema,
  EngineTypeListItemSchema,
  EngineTypeUpdateInputSchema,
  EngineTypesListQuerySchema,
  type EngineTypeCreateInput,
  type EngineTypeListItem,
  type EngineTypeUpdateInput,
  type EngineTypesListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const EngineTypeIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type EngineTypeIdParam = z.infer<typeof EngineTypeIdParamSchema>
