import { z } from 'zod'

import { ClaimKind, ClaimOutcome } from '../enums.js'

const dashboardOutcomeValues = [
  ClaimOutcome.Pending,
  ClaimOutcome.Accepted,
  ClaimOutcome.Rejected,
] as const

export const DashboardStatsSchema = z.object({
  total: z.coerce.number().int().nonnegative(),
  pending: z.coerce.number().int().nonnegative(),
  accepted: z.coerce.number().int().nonnegative(),
  rejected: z.coerce.number().int().nonnegative(),
  newThisMonth: z.coerce.number().int().nonnegative(),
  byKind: z.object({
    emotive: z.coerce.number().int().nonnegative(),
    domace: z.coerce.number().int().nonnegative(),
  }),
})

export type DashboardStats = z.infer<typeof DashboardStatsSchema>

export const DashboardOverdueItemSchema = z.object({
  kind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]),
  id: z.string().uuid(),
  mrNumber: z.string().nullable(),
  customerLabel: z.string().nullable(),
  daysOpen: z.coerce.number().int().nonnegative(),
  outcome: z.literal(ClaimOutcome.Pending),
  dateOfClaim: z.string().nullable(),
})

export type DashboardOverdueItem = z.infer<typeof DashboardOverdueItemSchema>

export const DashboardSummarySchema = z.object({
  stats: DashboardStatsSchema,
  overdue: z.array(DashboardOverdueItemSchema),
  recent: z.array(z.never()).length(0),
})

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>
