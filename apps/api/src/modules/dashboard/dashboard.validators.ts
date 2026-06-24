import { z } from 'zod'

import {
  DashboardChartMonthSchema,
  DashboardListItemSchema,
  DashboardStatsSchema,
  DashboardTrendsSchema,
} from '@mr/shared'

export const DashboardSummaryResponseSchema = z.object({
  stats: DashboardStatsSchema,
  trends: DashboardTrendsSchema,
  overdue: z.array(DashboardListItemSchema),
  recent: z.array(DashboardListItemSchema),
  chart: z.array(DashboardChartMonthSchema),
})

export type DashboardSummaryResponse = z.infer<typeof DashboardSummaryResponseSchema>
