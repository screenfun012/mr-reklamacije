import type {
  StatisticsOutcomeDistribution,
  StatisticsProcessingTime,
} from '../schemas/statistics.schema.js'

export interface OutcomeDistributionPercents {
  pendingPercent: number
  acceptedPercent: number
  rejectedPercent: number
}

function roundPercent(count: number, total: number): number {
  return Math.round((count / total) * 1000) / 10
}

export function computeOutcomeDistributionPercents(
  distribution: Pick<StatisticsOutcomeDistribution, 'total' | 'pending' | 'accepted' | 'rejected'>,
): OutcomeDistributionPercents {
  if (distribution.total === 0) {
    return { pendingPercent: 0, acceptedPercent: 0, rejectedPercent: 0 }
  }

  return {
    pendingPercent: roundPercent(distribution.pending, distribution.total),
    acceptedPercent: roundPercent(distribution.accepted, distribution.total),
    rejectedPercent: roundPercent(distribution.rejected, distribution.total),
  }
}

export function computeAcceptanceRatePercent(accepted: number, decided: number): number | null {
  if (decided === 0) {
    return null
  }

  return Math.round((accepted / decided) * 1000) / 10
}

export function roundStatisticsDays(value: number): number {
  return Math.round(value * 10) / 10
}

export function formatStatisticsDays(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '—'
  }

  return String(roundStatisticsDays(value))
}

export function hasProcessingTimeSample(
  processingTime: Pick<StatisticsProcessingTime, 'sampleSize'>,
): boolean {
  return processingTime.sampleSize > 0
}
