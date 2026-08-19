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

export const DashboardStatTrendSchema = z.object({
  previous: z.coerce.number().int().nonnegative(),
  delta: z.coerce.number().int(),
})

export type DashboardStatTrend = z.infer<typeof DashboardStatTrendSchema>

export const DashboardTrendsSchema = z.object({
  /** New claims this month vs previous calendar month (anchor_date). */
  newThisMonth: DashboardStatTrendSchema,
  /** Pending claims opened in each month that are still pending (intake rate). */
  pending: DashboardStatTrendSchema,
})

export type DashboardTrends = z.infer<typeof DashboardTrendsSchema>

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
  trends: DashboardTrendsSchema,
  overdue: z.array(DashboardListItemSchema),
  recent: z.array(DashboardListItemSchema),
  chart: z.array(DashboardChartMonthSchema),
  /**
   * The five workers blamed most often — and `null`, never `[]`, for a reader without
   * `employees.view_analytics`. How many times a NAMED person was blamed is exactly what that
   * permission protects, and an empty list would be a claim about the shop rather than about the
   * reader. `StatisticsByFaults.byEmployee` has behaved this way since Grupa D; this matches it.
   */
  topFaultEmployees: z
    .array(
      z.object({
        employeeId: z.string().uuid(),
        name: z.string(),
        faultCount: z.number().int().nonnegative(),
      }),
    )
    .nullable(),
})

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>
