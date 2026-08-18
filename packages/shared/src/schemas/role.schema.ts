import { z } from 'zod'

import { PERMISSIONS } from '../permissions.js'

const permissionValues = PERMISSIONS

export const RoleListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  nameSr: z.string(),
  nameEn: z.string(),
  description: z.string().nullable(),
  /** Maintained by the seed — editable only by duplicating it first. */
  isSystem: z.boolean(),
  /** How many people hold it. The screen refuses to delete a set somebody holds. */
  userCount: z.number().int().nonnegative(),
  permissionCount: z.number().int().nonnegative(),
})

export type RoleListItem = z.infer<typeof RoleListItemSchema>

export const RoleDetailSchema = RoleListItemSchema.extend({
  permissions: z.array(z.enum(permissionValues)),
})

export type RoleDetail = z.infer<typeof RoleDetailSchema>

const nameField = z.string().trim().min(2).max(80)

export const RoleCreateInputSchema = z.object({
  nameSr: nameField,
  nameEn: nameField,
  description: z.string().trim().max(400).nullable().optional(),
  permissions: z.array(z.enum(permissionValues)),
})

export type RoleCreateInput = z.infer<typeof RoleCreateInputSchema>

export const RoleUpdateInputSchema = z.object({
  nameSr: nameField.optional(),
  nameEn: nameField.optional(),
  description: z.string().trim().max(400).nullable().optional(),
  permissions: z.array(z.enum(permissionValues)).optional(),
})

export type RoleUpdateInput = z.infer<typeof RoleUpdateInputSchema>

/** A copy carries the original's actions; only the name has to be new. */
export const RoleDuplicateInputSchema = z.object({
  nameSr: nameField,
  nameEn: nameField,
})

export type RoleDuplicateInput = z.infer<typeof RoleDuplicateInputSchema>

/** One row of the permission matrix: the code, and what it is called in both languages. */
export const PermissionCatalogItemSchema = z.object({
  id: z.enum(permissionValues),
  module: z.string(),
  nameSr: z.string(),
  nameEn: z.string(),
  descriptionSr: z.string(),
  descriptionEn: z.string(),
})

export type PermissionCatalogItem = z.infer<typeof PermissionCatalogItemSchema>
