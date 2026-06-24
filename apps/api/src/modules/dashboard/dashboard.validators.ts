import { z } from 'zod'

export const DashboardSummaryResponseSchema = z.object({
  stats: z.object({
    total: z.number(),
    pending: z.number(),
    accepted: z.number(),
    rejected: z.number(),
    newThisMonth: z.number(),
    byKind: z.object({
      emotive: z.number(),
      domace: z.number(),
    }),
  }),
  overdue: z.array(
    z.object({
      kind: z.enum(['emotive', 'domace']),
      id: z.string().uuid(),
      mrNumber: z.string().nullable(),
      customerLabel: z.string().nullable(),
      daysOpen: z.number(),
      outcome: z.literal('pending'),
      dateOfClaim: z.string().nullable(),
    }),
  ),
  recent: z.array(z.never()),
})

export type DashboardSummaryResponse = z.infer<typeof DashboardSummaryResponseSchema>
