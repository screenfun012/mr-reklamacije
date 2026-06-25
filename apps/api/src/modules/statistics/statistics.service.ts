import {
  StatisticsVolumeTrendDirection,
  type StatisticsSummary,
  type StatisticsSummaryFilters,
  type StatisticsTrendMonth,
  type StatisticsVolumeTrend,
} from '@mr/shared'

import { ForbiddenError } from '../../core/errors/domain-errors.js'
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
  constructor(private readonly repo: StatisticsRepository) {}

  async getSummary(
    actor: StatisticsActor,
    filters: StatisticsSummaryFilters = {},
  ): Promise<StatisticsSummary> {
    const scope = resolveScope(actor)
    const queryContext = buildStatisticsQueryContext(scope, filters)
    const [
      byMonth,
      byYear,
      manufacturerItems,
      distribution,
      processingTime,
      acceptanceRateByMonth,
      sourceItems,
      employeeItems,
      engineTypeItems,
    ] = await Promise.all([
      this.repo.fetchTrendsByMonth(queryContext),
      this.repo.fetchTrendsByYear(queryContext),
      this.repo.fetchByManufacturer(queryContext),
      this.repo.fetchOutcomeDistribution(queryContext),
      this.repo.fetchProcessingTime(queryContext),
      this.repo.fetchAcceptanceRateByMonth(queryContext),
      this.repo.fetchBySource(queryContext),
      this.repo.fetchByEmployee(queryContext),
      this.repo.fetchByEngineType(queryContext),
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
      outcomes: {
        distribution,
        processingTime,
        acceptanceRateByMonth,
      },
      bySource: {
        items: sourceItems,
      },
      byEmployee: {
        items: employeeItems,
      },
      byEngineType: {
        items: engineTypeItems,
      },
    }
  }
}
