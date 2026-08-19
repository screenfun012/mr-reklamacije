import type { z } from 'zod'

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
