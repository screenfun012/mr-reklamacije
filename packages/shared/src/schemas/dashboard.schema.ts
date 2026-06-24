import { z } from 'zod'

import { ClaimKind } from '../enums.js'

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

export const DashboardListItemSchema = z.object({
  kind: z.enum([ClaimKind.Emotive, ClaimKind.Domace]),
  id: z.string().uuid(),
  mrNumber: z.string().nullable(),
  customerLabel: z.string().nullable(),
  daysOpen: z.coerce.number().int().nonnegative(),
})

export type DashboardListItem = z.infer<typeof DashboardListItemSchema>

export const DashboardChartMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  emotive: z.coerce.number().int().nonnegative(),
  domace: z.coerce.number().int().nonnegative(),
  total: z.coerce.number().int().nonnegative(),
})

export type DashboardChartMonth = z.infer<typeof DashboardChartMonthSchema>

export const DashboardSummarySchema = z.object({
  stats: DashboardStatsSchema,
  overdue: z.array(DashboardListItemSchema),
  recent: z.array(DashboardListItemSchema),
  chart: z.array(DashboardChartMonthSchema),
})

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>
