import { z } from 'zod'

export {
  DepartmentCreateInputSchema,
  DepartmentListItemSchema,
  DepartmentUpdateInputSchema,
  ReferenceListQuerySchema,
  type DepartmentCreateInput,
  type DepartmentListItem,
  type DepartmentUpdateInput,
  type ReferenceListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const DepartmentIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type DepartmentIdParam = z.infer<typeof DepartmentIdParamSchema>
