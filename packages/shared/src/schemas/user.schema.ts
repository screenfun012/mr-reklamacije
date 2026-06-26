import { z } from 'zod'

import { UserAccountStatus } from '../enums.js'

import { ReferenceListQuerySchema, ReferenceListResponseSchema } from './reference-data.schema.js'

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
