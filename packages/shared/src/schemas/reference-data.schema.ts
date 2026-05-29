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
})

export type EmployeesListQuery = z.infer<typeof EmployeesListQuerySchema>

export const CustomersListQuerySchema = ReferenceListQuerySchema.extend({
  kind: z.enum(customerKindValues).optional(),
})

export type CustomersListQuery = z.infer<typeof CustomersListQuerySchema>

export const ReferenceListResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  })

export const EmployeeListItemSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  is_active: z.boolean(),
  department_id: z.string().uuid().nullable(),
})

export type EmployeeListItem = z.infer<typeof EmployeeListItemSchema>

export const EngineTypeListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  manufacturer: z.string().nullable(),
  displacementCc: z.number().nullable(),
  isActive: z.boolean(),
  usageCount: z.number().int(),
})

export type EngineTypeListItem = z.infer<typeof EngineTypeListItemSchema>

export const EngineTypeCreateInputSchema = z.object({
  code: z.string().trim().min(1).max(50),
  manufacturer: z.string().trim().min(1).max(200).optional(),
  displacementCc: z.number().int().positive().optional(),
  notes: z.string().trim().max(4000).optional(),
})

export type EngineTypeCreateInput = z.infer<typeof EngineTypeCreateInputSchema>

export const ExternalPartyListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: z.enum(externalPartyKindValues),
  isActive: z.boolean(),
})

export type ExternalPartyListItem = z.infer<typeof ExternalPartyListItemSchema>

export const ExternalPartyCreateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(externalPartyKindValues),
})

export type ExternalPartyCreateInput = z.infer<typeof ExternalPartyCreateInputSchema>

export const CustomerListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  kind: z.enum(customerKindValues),
  country: z.string().nullable(),
  city: z.string().nullable(),
  isActive: z.boolean(),
})

export type CustomerListItem = z.infer<typeof CustomerListItemSchema>

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
})

export type ClaimSourceListItem = z.infer<typeof ClaimSourceListItemSchema>

export const DepartmentListItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  nameSr: z.string(),
  nameEn: z.string(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
})

export type DepartmentListItem = z.infer<typeof DepartmentListItemSchema>

export interface ReferenceListResponse<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}
