import { z } from 'zod'

export {
  CustomerCreateInputSchema,
  CustomerListItemSchema,
  CustomerUpdateInputSchema,
  CustomersListQuerySchema,
  type CustomerCreateInput,
  type CustomerListItem,
  type CustomerUpdateInput,
  type CustomersListQuery,
  type ReferenceListResponse,
} from '@mr/shared'

export const CustomerIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type CustomerIdParam = z.infer<typeof CustomerIdParamSchema>
