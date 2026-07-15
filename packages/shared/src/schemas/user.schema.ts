import { z } from 'zod'

import { ACCOUNT_APPROVAL_ROLE_CODES } from '../constants/approve-registration-roles.js'
import { SYSTEM_ROLE_CLIENT, SYSTEM_ROLE_CODES, SYSTEM_ROLE_VIEWER } from '../constants/roles.js'
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
  /** Free-text company a client typed at portal registration; null for staff. */
  requestedCompany: z.string().nullable(),
  /** false = deactivated: kept in the list but blocked from signing in. */
  isActive: z.boolean(),
})

export type UserListItem = z.infer<typeof UserListItemSchema>

/**
 * Account-status PATCH response: the user plus, when a client was just approved,
 * whether the activation email was sent (`null` when not applicable). Superset of
 * UserListItem so existing consumers keep working.
 */
export const UserAccountStatusResultSchema = UserListItemSchema.extend({
  activationEmailSent: z.boolean().nullable(),
})

export type UserAccountStatusResult = z.infer<typeof UserAccountStatusResultSchema>

export const UserListResponseSchema = ReferenceListResponseSchema(UserListItemSchema)

export type UserListResponse = z.infer<typeof UserListResponseSchema>

export const UserAccountStatusPatchInputSchema = z
  .object({
    status: z.enum([UserAccountStatus.Approved, UserAccountStatus.Rejected]),
    roleCode: z.enum(ACCOUNT_APPROVAL_ROLE_CODES).optional(),
    customerIds: z.array(z.string().uuid()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === UserAccountStatus.Rejected) {
      if (value.roleCode !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'roleCode is only allowed when approving',
          path: ['roleCode'],
        })
      }
      if (value.customerIds !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'customerIds is only allowed when approving',
          path: ['customerIds'],
        })
      }
      return
    }

    if (value.roleCode === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'roleCode is required when approving',
        path: ['roleCode'],
      })
      return
    }
    if (value.roleCode === SYSTEM_ROLE_CLIENT) {
      if (value.customerIds === undefined || value.customerIds.length === 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'customerIds is required when approving a client',
          path: ['customerIds'],
        })
      }
    } else if (value.customerIds !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'customerIds is only allowed for the client role',
        path: ['customerIds'],
      })
    }
  })
  .transform((value) => {
    if (value.status === UserAccountStatus.Approved) {
      // superRefine rejects an approval without a roleCode, so it is always present
      // here; the fallback is unreachable and least-privilege (never operator).
      const roleCode = value.roleCode ?? SYSTEM_ROLE_VIEWER
      const customerIds =
        roleCode === SYSTEM_ROLE_CLIENT ? [...new Set(value.customerIds ?? [])] : []

      return {
        status: value.status,
        roleCode,
        customerIds,
      }
    }

    return { status: value.status }
  })

/** Parsed (post-transform) shape used by the API service. */
export type UserAccountStatusPatchInput = z.infer<typeof UserAccountStatusPatchInputSchema>

/**
 * Request body shape the client sends (pre-transform): `customerIds` is optional
 * and must be omitted for non-client roles — the schema rejects it otherwise.
 */
export type UserAccountStatusPatchBody = z.input<typeof UserAccountStatusPatchInputSchema>

export const UserIdParamSchema = z.object({
  id: z.string().uuid(),
})

export type UserIdParam = z.infer<typeof UserIdParamSchema>

/** Password policy — mirrors Better-Auth `emailAndPassword` config (options.ts). */
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 128

export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH)

export const UserPasswordResetInputSchema = z.object({
  newPassword: PasswordSchema,
})

export type UserPasswordResetInput = z.infer<typeof UserPasswordResetInputSchema>

export const UserSetActiveInputSchema = z.object({
  isActive: z.boolean(),
})

export type UserSetActiveInput = z.infer<typeof UserSetActiveInputSchema>

export const UserRolesReplaceInputSchema = z.object({
  roleCodes: z
    .array(z.enum(systemRoleCodeValues))
    .min(1)
    .refine((codes) => new Set(codes).size === codes.length, {
      message: 'Duplicate role codes are not allowed',
    }),
})

export type UserRolesReplaceInput = z.infer<typeof UserRolesReplaceInputSchema>
