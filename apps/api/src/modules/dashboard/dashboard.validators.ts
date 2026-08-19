import { z } from 'zod'

import { DashboardSummarySchema } from '@mr/shared'

/**
 * The wire contract IS the shared one.
 *
 * This file used to re-declare the same five fields from the same sub-schemas, which is a copy that
 * drifts on the first field either side adds — as it nearly did on 2026-08-19, when
 * `topFaultEmployees` landed in `@mr/shared` and the API kept answering with the old shape.
 */
export const DashboardSummaryResponseSchema = DashboardSummarySchema

export type DashboardSummaryResponse = z.infer<typeof DashboardSummaryResponseSchema>

/**
 * How many months the trend chart covers. Clamped rather than free: the query builds one row per
 * month with `generate_series`, and an unbounded number there is an unbounded response.
 */
export const DashboardSummaryQuerySchema = z.object({
  months: z.coerce.number().int().min(6).max(24).optional(),
})

export type DashboardSummaryQuery = z.infer<typeof DashboardSummaryQuerySchema>
