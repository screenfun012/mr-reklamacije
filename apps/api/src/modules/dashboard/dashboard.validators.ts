import { z } from 'zod'

import {
  DashboardChartMonthSchema,
  DashboardListItemSchema,
  DashboardStatsSchema,
} from '@mr/shared'

export const DashboardSummaryResponseSchema = z.object({
  stats: DashboardStatsSchema,
  overdue: z.array(DashboardListItemSchema),
  recent: z.array(DashboardListItemSchema),
  chart: z.array(DashboardChartMonthSchema),
})

export type DashboardSummaryResponse = z.infer<typeof DashboardSummaryResponseSchema>
