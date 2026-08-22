import {
  StatisticsVolumeTrendDirection,
  type StatisticsSummary,
  type StatisticsSummaryFilters,
  type StatisticsTrendMonth,
  type StatisticsVolumeTrend,
} from '@mr/shared'

import { ForbiddenError } from '../../core/errors/domain-errors.js'
import {
  SummaryCache,
  SUMMARY_CACHE_TTL_SECONDS,
} from '../../infrastructure/cache/summary-cache.js'
import { buildStatisticsQueryContext } from './statistics-claim-filter.js'
import type { StatisticsRepository } from './statistics.repository.js'
import type { StatisticsActor, StatisticsScope } from './statistics.types.js'

const VOLUME_TREND_PERIOD_MONTHS = 12

function canViewEmotiveStatistics(actor: StatisticsActor): boolean {
  return (
    actor.permissions.includes('statistics.view_emotive') ||
    actor.permissions.includes('statistics.view_overall')
  )
}

function canViewDomaceStatistics(actor: StatisticsActor): boolean {
  return (
    actor.permissions.includes('statistics.view_domace') ||
    actor.permissions.includes('statistics.view_overall')
  )
}

function resolveScope(actor: StatisticsActor): StatisticsScope {
  const includeEmotive = canViewEmotiveStatistics(actor)
  const includeDomace = canViewDomaceStatistics(actor)

  if (!includeEmotive && !includeDomace) {
    throw new ForbiddenError()
  }

  return { includeEmotive, includeDomace }
}

export function computeVolumeTrend(
  byMonth: readonly StatisticsTrendMonth[],
): StatisticsVolumeTrend {
  if (byMonth.length === 0) {
    return {
      direction: StatisticsVolumeTrendDirection.Stable,
      currentPeriodTotal: 0,
      previousPeriodTotal: 0,
      delta: 0,
      deltaPercent: null,
    }
  }

  const recent = byMonth.slice(-VOLUME_TREND_PERIOD_MONTHS)
  const previous =
    byMonth.length >= VOLUME_TREND_PERIOD_MONTHS * 2
      ? byMonth.slice(-VOLUME_TREND_PERIOD_MONTHS * 2, -VOLUME_TREND_PERIOD_MONTHS)
      : byMonth.slice(0, Math.max(0, byMonth.length - recent.length))

  const currentPeriodTotal = recent.reduce((sum, row) => sum + row.total, 0)
  const previousPeriodTotal = previous.reduce((sum, row) => sum + row.total, 0)
  const delta = currentPeriodTotal - previousPeriodTotal

  let direction: StatisticsVolumeTrendDirection = StatisticsVolumeTrendDirection.Stable
  if (delta > 0) {
    direction = StatisticsVolumeTrendDirection.Rising
  } else if (delta < 0) {
    direction = StatisticsVolumeTrendDirection.Falling
  }

  const deltaPercent =
    previousPeriodTotal > 0 ? Math.round((delta / previousPeriodTotal) * 1000) / 10 : null

  return {
    direction,
    currentPeriodTotal,
    previousPeriodTotal,
    delta,
    deltaPercent,
  }
}

export class StatisticsService {
  constructor(
    private readonly repo: StatisticsRepository,
    private readonly summaryCache: SummaryCache,
  ) {}

  async getSummary(
    actor: StatisticsActor,
    filters: StatisticsSummaryFilters = {},
  ): Promise<StatisticsSummary> {
    // Resolve scope first: it is the auth gate (throws before any cache work) and, together
    // with the filters, forms the cache key — the summary is NOT keyed per user.
    const scope = resolveScope(actor)
    const summary = await this.summaryCache.read(
      'statistics',
      [
        scope.includeEmotive,
        scope.includeDomace,
        filters.kind,
        filters.manufacturerId,
        filters.categoryCode,
        filters.fieldCode,
        filters.optionCode,
        filters.year,
        filters.dateFrom?.toISOString(),
        filters.dateTo?.toISOString(),
      ],
      SUMMARY_CACHE_TTL_SECONDS,
      () => this.computeSummary(scope, filters),
    )

    /**
     * Both withholdings happen AFTER the cache read, never before it.
     *
     * The summary is cached by scope and filters and deliberately NOT per user, so a permitted
     * reader and an unpermitted one share one entry — stripping before the cache would mean
     * whoever asked first decided what the other sees. Withholding on the way out is the only
     * placement that cannot leak in either direction, and it costs one object spread.
     *
     * Both permissions sat in the catalog with nothing reading them (measured 2026-08-17: 27 of 97
     * were in that state). `statistics.view_financial` guards the DOMACE amounts;
     * `employees.view_analytics` guards the two places this screen measures a NAMED person — how
     * many claims sit on a worker, and how many faults he was blamed for. Departments and external
     * parties are not withheld: a department is a place, and the permission is named after people.
     *
     * Each section is withheld as `null` rather than emptied. An empty list is a statement about
     * the business ("no amounts were entered", "nobody was blamed"); this is a statement about the
     * reader, and the screen has to be able to tell them apart.
     */
    const withMoney = actor.permissions.includes('statistics.view_financial')
    const withPeople = actor.permissions.includes('employees.view_analytics')

    if (withMoney && withPeople) {
      return summary
    }

    return {
      ...summary,
      domaceAmounts: withMoney ? summary.domaceAmounts : null,
      byEmployee: withPeople ? summary.byEmployee : null,
      byFaults: withPeople ? summary.byFaults : { ...summary.byFaults, byEmployee: null },
    }
  }

  private async computeSummary(
    scope: StatisticsScope,
    filters: StatisticsSummaryFilters,
  ): Promise<StatisticsSummary> {
    const queryContext = buildStatisticsQueryContext(scope, filters)
    const [
      byMonth,
      byYear,
      manufacturerItems,
      categoryItems,
      distribution,
      processingTime,
      acceptanceRateByMonth,
      employeeItems,
      engineTypeItems,
      domaceAmounts,
      customerItems,
      byFaults,
    ] = await Promise.all([
      this.repo.fetchTrendsByMonth(queryContext),
      this.repo.fetchTrendsByYear(queryContext),
      this.repo.fetchByManufacturer(queryContext),
      this.repo.fetchByCategory(queryContext),
      this.repo.fetchOutcomeDistribution(queryContext),
      this.repo.fetchProcessingTime(queryContext),
      this.repo.fetchAcceptanceRateByMonth(queryContext),
      this.repo.fetchByEmployee(queryContext),
      this.repo.fetchByEngineType(queryContext),
      this.repo.fetchDomaceAmounts(queryContext),
      this.repo.fetchByCustomer(queryContext),
      this.repo.fetchFaultAttribution(queryContext),
    ])

    return {
      trends: {
        byMonth,
        byYear,
        volumeTrend: computeVolumeTrend(byMonth),
      },
      byManufacturer: {
        items: manufacturerItems,
      },
      byCategory: {
        items: categoryItems,
      },
      outcomes: {
        distribution,
        processingTime,
        acceptanceRateByMonth,
      },
      byEmployee: {
        items: employeeItems,
      },
      byEngineType: {
        items: engineTypeItems,
      },
      domaceAmounts,
      byCustomer: {
        items: customerItems,
      },
      byFaults,
    }
  }
}
