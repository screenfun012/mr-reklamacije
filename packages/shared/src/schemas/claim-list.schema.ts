import { z } from 'zod'

import { ClaimKind, ClaimOutcome } from '../enums.js'
import { DomaceClaimListItemSchema } from './domace-claim.schema.js'
import { EmotiveClaimListItemSchema } from './emotive-claim.schema.js'

const claimOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
  ClaimOutcome.Archived,
] as const

const claimKindValues = [ClaimKind.Emotive, ClaimKind.Domace] as const

export const ClaimSortBy = {
  DateOfClaim: 'dateOfClaim',
  DateOfFinish: 'dateOfFinish',
} as const

export type ClaimSortBy = (typeof ClaimSortBy)[keyof typeof ClaimSortBy]

export const claimSortByValues = [ClaimSortBy.DateOfClaim, ClaimSortBy.DateOfFinish] as const

export const ClaimSortDir = {
  Asc: 'asc',
  Desc: 'desc',
} as const

export type ClaimSortDir = (typeof ClaimSortDir)[keyof typeof ClaimSortDir]

export const claimSortDirValues = [ClaimSortDir.Asc, ClaimSortDir.Desc] as const

const boolQueryParam = z
  .string()
  .optional()
  .transform((value: string | undefined) => value !== 'false')

export const ClaimListQuerySchema = z.object({
  kind: z.enum(claimKindValues).optional(),
  outcome: z.enum(claimOutcomeValues).optional(),
  sourceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  manufacturerId: z.string().uuid().optional(),
  engineTypeId: z.string().uuid().optional(),
  // By CODE, never by id (spec §4.2): this travels in the URL, so it must survive a
  // database restore and read plainly in a bookmark. An unknown code yields an empty
  // list, not an error — the repository resolves it with a semi-join.
  categoryCode: z.string().trim().min(1).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().trim().min(1).optional(),
  sortBy: z.enum(claimSortByValues).optional(),
  sortDir: z.enum(claimSortDirValues).optional(),
  includeDeleted: boolQueryParam.default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(10), z.literal(25), z.literal(50)]))
    .default(10),
})

export type ClaimListQuery = z.infer<typeof ClaimListQuerySchema>

export const ClaimListItemSchema = z.discriminatedUnion('kind', [
  EmotiveClaimListItemSchema,
  DomaceClaimListItemSchema,
])

export type ClaimListItem = z.infer<typeof ClaimListItemSchema>

export const ClaimListResponseSchema = z.object({
  items: z.array(ClaimListItemSchema),
  total: z.coerce.number().int().nonnegative(),
  page: z.number().int().min(1),
  pageSize: z.union([z.literal(10), z.literal(25), z.literal(50)]),
})

export type ClaimListResponse = z.infer<typeof ClaimListResponseSchema>
