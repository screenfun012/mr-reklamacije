import { z } from 'zod'

export {
  EngineManufacturerCreateInputSchema,
  EngineManufacturerListItemSchema,
  EngineManufacturerUpdateInputSchema,
  ReferenceListQuerySchema,
  type EngineManufacturerCreateInput,
  type EngineManufacturerListItem,
  type EngineManufacturerUpdateInput,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const EngineManufacturerIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type EngineManufacturerIdParam = z.infer<typeof EngineManufacturerIdParamSchema>
