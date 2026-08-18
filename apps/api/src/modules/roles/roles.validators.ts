import { z } from 'zod'

export {
  RoleCreateInputSchema,
  RoleDuplicateInputSchema,
  RoleUpdateInputSchema,
  type PermissionCatalogItem,
  type RoleCreateInput,
  type RoleDetail,
  type RoleDuplicateInput,
  type RoleListItem,
  type RoleUpdateInput,
} from '@mr/shared'

export const RoleIdParamSchema = z.object({
  id: z.string().uuid(),
})
