import { z } from 'zod'

export const STATISTICS_TREND_MONTH_COUNT = 24

export const StatisticsTrendMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  emotive: z.coerce.number().int().nonnegative(),
  domace: z.coerce.number().int().nonnegative(),
  total: z.coerce.number().int().nonnegative(),
})

export type StatisticsTrendMonth = z.infer<typeof StatisticsTrendMonthSchema>

export const StatisticsTrendYearSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  emotive: z.coerce.number().int().nonnegative(),
  domace: z.coerce.number().int().nonnegative(),
  total: z.coerce.number().int().nonnegative(),
})

export type StatisticsTrendYear = z.infer<typeof StatisticsTrendYearSchema>

export const StatisticsVolumeTrendDirection = {
  Rising: 'rising',
  Falling: 'falling',
  Stable: 'stable',
} as const

export type StatisticsVolumeTrendDirection =
  (typeof StatisticsVolumeTrendDirection)[keyof typeof StatisticsVolumeTrendDirection]

export const StatisticsVolumeTrendSchema = z.object({
  direction: z.enum([
    StatisticsVolumeTrendDirection.Rising,
    StatisticsVolumeTrendDirection.Falling,
    StatisticsVolumeTrendDirection.Stable,
  ]),
  currentPeriodTotal: z.coerce.number().int().nonnegative(),
  previousPeriodTotal: z.coerce.number().int().nonnegative(),
  delta: z.coerce.number().int(),
  deltaPercent: z.coerce.number().nullable(),
})

export type StatisticsVolumeTrend = z.infer<typeof StatisticsVolumeTrendSchema>

export const StatisticsManufacturerRowSchema = z.object({
  manufacturerId: z.string().uuid().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  total: z.coerce.number().int().nonnegative(),
  pending: z.coerce.number().int().nonnegative(),
  accepted: z.coerce.number().int().nonnegative(),
  rejected: z.coerce.number().int().nonnegative(),
})

export type StatisticsManufacturerRow = z.infer<typeof StatisticsManufacturerRowSchema>

export const StatisticsByManufacturerSchema = z.object({
  items: z.array(StatisticsManufacturerRowSchema),
})

export type StatisticsByManufacturer = z.infer<typeof StatisticsByManufacturerSchema>

export const StatisticsOutcomeDistributionSchema = z.object({
  pending: z.coerce.number().int().nonnegative(),
  accepted: z.coerce.number().int().nonnegative(),
  rejected: z.coerce.number().int().nonnegative(),
  total: z.coerce.number().int().nonnegative(),
})

export type StatisticsOutcomeDistribution = z.infer<typeof StatisticsOutcomeDistributionSchema>

export const StatisticsProcessingTimeSchema = z.object({
  averageDays: z.coerce.number().nonnegative().nullable(),
  medianDays: z.coerce.number().nonnegative().nullable(),
  maxDays: z.coerce.number().int().nonnegative(),
  sampleSize: z.coerce.number().int().nonnegative(),
})

export type StatisticsProcessingTime = z.infer<typeof StatisticsProcessingTimeSchema>

export const StatisticsAcceptanceRateMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  decided: z.coerce.number().int().nonnegative(),
  accepted: z.coerce.number().int().nonnegative(),
  ratePercent: z.coerce.number().nullable(),
})

export type StatisticsAcceptanceRateMonth = z.infer<typeof StatisticsAcceptanceRateMonthSchema>

export const StatisticsOutcomesSchema = z.object({
  distribution: StatisticsOutcomeDistributionSchema,
  processingTime: StatisticsProcessingTimeSchema,
  acceptanceRateByMonth: z.array(StatisticsAcceptanceRateMonthSchema),
})

export type StatisticsOutcomes = z.infer<typeof StatisticsOutcomesSchema>

export const StatisticsEmployeeRowSchema = z.object({
  employeeId: z.string().uuid().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  total: z.coerce.number().int().nonnegative(),
})

export type StatisticsEmployeeRow = z.infer<typeof StatisticsEmployeeRowSchema>

export const StatisticsByEmployeeSchema = z.object({
  items: z.array(StatisticsEmployeeRowSchema),
})

export type StatisticsByEmployee = z.infer<typeof StatisticsByEmployeeSchema>

export const StatisticsEngineTypeRowSchema = z.object({
  engineTypeId: z.string().uuid().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  total: z.coerce.number().int().nonnegative(),
})

export type StatisticsEngineTypeRow = z.infer<typeof StatisticsEngineTypeRowSchema>

export const StatisticsByEngineTypeSchema = z.object({
  items: z.array(StatisticsEngineTypeRowSchema),
})

export type StatisticsByEngineType = z.infer<typeof StatisticsByEngineTypeSchema>

export const StatisticsDomaceAmountsSchema = z.object({
  totalAmount: z.coerce.number().nonnegative(),
  claimCount: z.coerce.number().int().nonnegative(),
})

export type StatisticsDomaceAmounts = z.infer<typeof StatisticsDomaceAmountsSchema>

export const StatisticsCustomerRowSchema = z.object({
  customerId: z.string().uuid().nullable(),
  code: z.string().min(1),
  name: z.string().min(1),
  total: z.coerce.number().int().nonnegative(),
  pending: z.coerce.number().int().nonnegative(),
  accepted: z.coerce.number().int().nonnegative(),
  rejected: z.coerce.number().int().nonnegative(),
})

export type StatisticsCustomerRow = z.infer<typeof StatisticsCustomerRowSchema>

export const StatisticsByCustomerSchema = z.object({
  items: z.array(StatisticsCustomerRowSchema),
})

export type StatisticsByCustomer = z.infer<typeof StatisticsByCustomerSchema>

export const StatisticsFaultPartyRowSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1),
  name: z.string().min(1),
  total: z.coerce.number().int().nonnegative(),
})

export type StatisticsFaultPartyRow = z.infer<typeof StatisticsFaultPartyRowSchema>

export const StatisticsByFaultsSchema = z.object({
  /**
   * `null` for a reader without `employees.view_analytics` — how many faults a NAMED person was
   * blamed for is the thing that permission protects. An empty array would say "nobody was blamed
   * for anything", which is a statement about the shop and not about the reader.
   */
  byEmployee: z.array(StatisticsFaultPartyRowSchema).nullable(),
  // Not withheld: a department is a place, not a person, and the permission is named after people.
  byDepartment: z.array(StatisticsFaultPartyRowSchema),
  byExternalParty: z.array(StatisticsFaultPartyRowSchema),
})

export type StatisticsByFaults = z.infer<typeof StatisticsByFaultsSchema>

export const StatisticsTrendsSchema = z.object({
  byMonth: z.array(StatisticsTrendMonthSchema),
  byYear: z.array(StatisticsTrendYearSchema),
  volumeTrend: StatisticsVolumeTrendSchema,
})

export type StatisticsTrends = z.infer<typeof StatisticsTrendsSchema>

export const StatisticsSummarySchema = z.object({
  trends: StatisticsTrendsSchema,
  byManufacturer: StatisticsByManufacturerSchema,
  outcomes: StatisticsOutcomesSchema,
  /** `null` for a reader without `employees.view_analytics` — see `StatisticsByFaultsSchema`. */
  byEmployee: StatisticsByEmployeeSchema.nullable(),
  byEngineType: StatisticsByEngineTypeSchema,
  /**
   * `null` for a reader without `statistics.view_financial` — the money is the one section of this
   * summary that is withheld rather than shown empty. An empty section would read as "there are no
   * amounts", which is a different and false statement.
   */
  domaceAmounts: StatisticsDomaceAmountsSchema.nullable(),
  byCustomer: StatisticsByCustomerSchema,
  byFaults: StatisticsByFaultsSchema,
})

export type StatisticsSummary = z.infer<typeof StatisticsSummarySchema>
