import { z } from 'zod'

import { SYSTEM_ROLE_CODES } from '../constants/roles.js'
import { UserAccountStatus } from '../enums.js'

import { ReferenceListQuerySchema, ReferenceListResponseSchema } from './reference-data.schema.js'

const systemRoleCodeValues = [...SYSTEM_ROLE_CODES] as [
  (typeof SYSTEM_ROLE_CODES)[number],
  ...(typeof SYSTEM_ROLE_CODES)[number][],
]

const userAccountStatusValues = [
  UserAccountStatus.Pending,
  UserAccountStatus.Approved,
  UserAccountStatus.Rejected,
] as const

export const UsersListQuerySchema = ReferenceListQuerySchema.extend({
  accountStatus: z.enum(userAccountStatusValues).optional(),
})

export type UsersListQuery = z.infer<typeof UsersListQuerySchema>

export const UserListItemSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  accountStatus: z.enum(userAccountStatusValues),
  createdAt: z.string(),
  roles: z.array(z.string()),
})

export type UserListItem = z.infer<typeof UserListItemSchema>

export const UserListResponseSchema = ReferenceListResponseSchema(UserListItemSchema)

export type UserListResponse = z.infer<typeof UserListResponseSchema>

export const UserAccountStatusPatchInputSchema = z.object({
  status: z.enum([UserAccountStatus.Approved, UserAccountStatus.Rejected]),
})

export type UserAccountStatusPatchInput = z.infer<typeof UserAccountStatusPatchInputSchema>

export const UserIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type UserIdParam = z.infer<typeof UserIdParamSchema>

export const UserRolesReplaceInputSchema = z.object({
  roleCodes: z
    .array(z.enum(systemRoleCodeValues))
    .min(1)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: 'Duplicate role codes are not allowed',
    }),
})

export type UserRolesReplaceInput = z.infer<typeof UserRolesReplaceInputSchema>
