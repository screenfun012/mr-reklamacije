import { z } from 'zod'

export {
  EmployeeCreateInputSchema,
  EmployeeListItemSchema,
  EmployeesListQuerySchema,
  EmployeeUpdateInputSchema,
  type EmployeeCreateInput,
  type EmployeeListItem,
  type EmployeesListQuery,
  type EmployeeUpdateInput,
  type ReferenceListResponse,
} from '@mr/shared'

export const EmployeeIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type EmployeeIdParam = z.infer<typeof EmployeeIdParamSchema>
