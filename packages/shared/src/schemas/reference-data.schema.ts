import { z } from 'zod'

import { CustomerKind, ExternalPartyKind } from '../enums.js'

const customerKindValues = [
  CustomerKind.EmotivePartner,
  CustomerKind.DomesticCompany,
  CustomerKind.DomesticIndividual,
] as const

const externalPartyKindValues = [
  ExternalPartyKind.Supplier,
  ExternalPartyKind.Subcontractor,
  ExternalPartyKind.Manufacturer,
  ExternalPartyKind.Other,
] as const

const boolQueryParam = z
  .string()
  .optional()
  .transform((value: string | undefined) => value !== 'false')

export const ReferenceListQuerySchema = z.object({
  search: z.string().trim().min(1).optional(),
  activeOnly: boolQueryParam,
  limit: z.coerce.number().int().min(1).max(50).default(50),
  cursor: z.string().trim().min(1).optional(),
})

export type ReferenceListQuery = z.infer<typeof ReferenceListQuerySchema>

export const EmployeesListQuerySchema = ReferenceListQuerySchema.extend({
  departmentId: z.string().uuid().optional(),
  // Only workers whose department is flagged as an "assigned worker" source.
  // Defaults to off (absent = every worker) — opt in with `assignableOnly=true`.
  assignableOnly: z
    .string()
    .optional()
    .transform((value: string | undefined) => value === 'true'),
})

export type EmployeesListQuery = z.infer<typeof EmployeesListQuerySchema>

export const CustomersListQuerySchema = ReferenceListQuerySchema.extend({
  kind: z.enum(customerKindValues).optional(),
})

export type CustomersListQuery = z.infer<typeof CustomersListQuerySchema>

export const EngineTypesListQuerySchema = ReferenceListQuerySchema.extend({
  manufacturerId: z.string().uuid().optional(),
})

export type EngineTypesListQuery = z.infer<typeof EngineTypesListQuerySchema>

export const ReferenceListResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })

export const EmployeeListItemSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  departmentId: z.string().uuid().nullable(),
  departmentName: z.string().nullable(),
  isActive: z.boolean(),
  usageCount: z.number().int().nonnegative(),
})

export type EmployeeListItem = z.infer<typeof EmployeeListItemSchema>

export const EmployeeCreateInputSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  departmentId: z.string().uuid().nullable().optional(),
})

export type EmployeeCreateInput = z.infer<typeof EmployeeCreateInputSchema>

export const EmployeeUpdateInputSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    departmentId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type EmployeeUpdateInput = z.infer<typeof EmployeeUpdateInputSchema>

export const EngineTypeListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  manufacturerId: z.string().uuid().nullable(),
  manufacturerName: z.string().nullable(),
  displacementCc: z.number().nullable(),
  notes: z.string().nullable(),
  isActive: z.boolean(),
  usageCount: z.number().int(),
})

export type EngineTypeListItem = z.infer<typeof EngineTypeListItemSchema>

export const EngineTypeCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(50),
  manufacturerId: z.string().uuid(),
  displacementCc: z.number().int().positive().optional(),
  notes: z.string().trim().max(4000).optional(),
})

export type EngineTypeCreateInput = z.infer<typeof EngineTypeCreateInputSchema>

export const EngineTypeUpdateInputSchema = z
  .object({
    manufacturerId: z.string().uuid().nullable().optional(),
    displacementCc: z.number().int().positive().nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type EngineTypeUpdateInput = z.infer<typeof EngineTypeUpdateInputSchema>

export const EngineManufacturerListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  usageCount: z.number().int().nonnegative(),
})

export type EngineManufacturerListItem = z.infer<typeof EngineManufacturerListItemSchema>

export const EngineManufacturerCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
})

export type EngineManufacturerCreateInput = z.infer<typeof EngineManufacturerCreateInputSchema>

export const EngineManufacturerUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type EngineManufacturerUpdateInput = z.infer<typeof EngineManufacturerUpdateInputSchema>

export const ClaimCategoryListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  usageCount: z.number().int().nonnegative(),
})

export type ClaimCategoryListItem = z.infer<typeof ClaimCategoryListItemSchema>

export const ClaimCategoryCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
})

export type ClaimCategoryCreateInput = z.infer<typeof ClaimCategoryCreateInputSchema>

export const ClaimCategoryUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type ClaimCategoryUpdateInput = z.infer<typeof ClaimCategoryUpdateInputSchema>

/**
 * The category resolved onto a claim detail wire (Faza 1, spec §3.3) — the minimal
 * `{ id, code, name }` a claim needs to display and filter by, distinct from the fuller
 * `ClaimCategoryListItemSchema` the admin catalogue screen manages (sortOrder/isActive/
 * usageCount belong to the catalogue, not to the claim that references one row of it).
 */
export const ClaimCategoryRefSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
})

export type ClaimCategoryRef = z.infer<typeof ClaimCategoryRefSchema>

export const ExternalPartyListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: z.enum(externalPartyKindValues),
  isActive: z.boolean(),
  usageCount: z.number().int().nonnegative(),
})

export type ExternalPartyListItem = z.infer<typeof ExternalPartyListItemSchema>

export const ExternalPartyCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(externalPartyKindValues),
})

export type ExternalPartyCreateInput = z.infer<typeof ExternalPartyCreateInputSchema>

export const ExternalPartyUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    kind: z.enum(externalPartyKindValues).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type ExternalPartyUpdateInput = z.infer<typeof ExternalPartyUpdateInputSchema>

export const CustomerListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: z.enum(customerKindValues),
  country: z.string().nullable(),
  city: z.string().nullable(),
  isActive: z.boolean(),
  usageCount: z.number().int(),
})

export type CustomerListItem = z.infer<typeof CustomerListItemSchema>

export const CustomerCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  country: z.string().trim().min(1).max(200).optional(),
  city: z.string().trim().min(1).max(200).optional(),
})

export type CustomerCreateInput = z.infer<typeof CustomerCreateInputSchema>

export const CustomerUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    country: z.string().trim().min(1).max(200).nullable().optional(),
    city: z.string().trim().min(1).max(200).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type CustomerUpdateInput = z.infer<typeof CustomerUpdateInputSchema>

export const ClaimSourceDefaultCustomerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const ClaimSourceListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  claimNumberPrefix: z.string().nullable(),
  sortOrder: z.number().int(),
  defaultCustomerId: z.string().uuid().nullable(),
  defaultCustomer: ClaimSourceDefaultCustomerSchema.nullable(),
  isActive: z.boolean(),
  usageCount: z.number().int().nonnegative(),
})

export type ClaimSourceListItem = z.infer<typeof ClaimSourceListItemSchema>

export const ClaimSourceCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(200),
  claimNumberPrefix: z.string().trim().min(1).max(50).optional(),
  sortOrder: z.number().int().min(0).optional(),
  defaultCustomerId: z.string().uuid().optional(),
})

export type ClaimSourceCreateInput = z.infer<typeof ClaimSourceCreateInputSchema>

export const ClaimSourceUpdateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    claimNumberPrefix: z.string().trim().min(1).max(50).nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    defaultCustomerId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type ClaimSourceUpdateInput = z.infer<typeof ClaimSourceUpdateInputSchema>

export const DepartmentListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  nameSr: z.string(),
  nameEn: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  providesAssignedWorkers: z.boolean(),
  usageCount: z.number().int().nonnegative(),
})

export type DepartmentListItem = z.infer<typeof DepartmentListItemSchema>

export const DepartmentCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(50),
  nameSr: z.string().trim().min(1).max(200),
  nameEn: z.string().trim().min(1).max(200),
  sortOrder: z.number().int().min(0).optional(),
  providesAssignedWorkers: z.boolean().optional(),
})

export type DepartmentCreateInput = z.infer<typeof DepartmentCreateInputSchema>

export const DepartmentUpdateInputSchema = z
  .object({
    nameSr: z.string().trim().min(1).max(200).optional(),
    nameEn: z.string().trim().min(1).max(200).optional(),
    sortOrder: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    providesAssignedWorkers: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type DepartmentUpdateInput = z.infer<typeof DepartmentUpdateInputSchema>

export interface ReferenceListResponse<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}
