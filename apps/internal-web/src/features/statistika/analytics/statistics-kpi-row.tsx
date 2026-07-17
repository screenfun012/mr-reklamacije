import { formatEuroAmount, type StatisticsSummary } from '@mr/shared'
import { m } from '@mr/i18n'
import { cn } from '@mr/ui'

interface KpiCell {
  label: string
  value: string
  border: string
  dot: string
  valueClass: string
}

/**
 * KPI strip above the charts (README §8 item 2): Ukupno / EMOTIVE / Domaće /
 * Prihvaćene / Odbijene / Na čekanju / Stopa prihvatanja. Pure projection of
 * the summary the page already fetched — no extra requests.
 */
export function StatisticsKpiRow({ summary }: { summary: StatisticsSummary }): React.ReactElement {
  const { distribution } = summary.outcomes
  const emotiveTotal = summary.trends.byMonth.reduce((sum, row) => sum + row.emotive, 0)
  const domaceTotal = summary.trends.byMonth.reduce((sum, row) => sum + row.domace, 0)
  const decided = distribution.accepted + distribution.rejected
  const acceptanceRate =
    decided > 0 ? `${Math.round((distribution.accepted / decided) * 100)}%` : '—'

  const cells: KpiCell[] = [
    {
      label: m.statistika_analytics_total(),
      value: String(distribution.total),
      border: 'border-mri-border',
      dot: 'bg-mri-text2',
      valueClass: 'text-mri-text',
    },
    {
      label: 'EMOTIVE',
      value: String(emotiveTotal),
      border: 'border-mri-border',
      dot: 'bg-mri-info',
      valueClass: 'text-mri-text',
    },
    {
      label: m.dashboard_chart_domace(),
      value: String(domaceTotal),
      border: 'border-mri-border',
      dot: 'bg-mri-domace',
      valueClass: 'text-mri-text',
    },
    {
      label: m.statistika_kpi_domace_amount(),
      value:
        summary.domaceAmounts.claimCount > 0
          ? formatEuroAmount(summary.domaceAmounts.totalAmount)
          : '—',
      border: 'border-mri-border',
      dot: 'bg-mri-domace',
      valueClass: 'text-mri-text',
    },
    {
      label: m.outcome_accepted(),
      value: String(distribution.accepted),
      border: 'border-[rgba(31,169,113,0.3)]',
      dot: 'bg-mri-ok',
      valueClass: 'text-mri-ok',
    },
    {
      label: m.outcome_rejected(),
      value: String(distribution.rejected),
      border: 'border-[rgba(224,92,82,0.3)]',
      dot: 'bg-mri-bad',
      valueClass: 'text-mri-bad',
    },
    {
      label: m.outcome_pending(),
      value: String(distribution.pending),
      border: 'border-[rgba(245,166,35,0.35)]',
      dot: 'bg-mri-warn',
      valueClass: 'text-mri-warn',
    },
    {
      label: m.internal_kpi_acceptance_rate(),
      value: acceptanceRate,
      border: 'border-mri-border',
      dot: 'bg-mri-ok',
      valueClass: 'text-mri-text',
    },
  ]

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3.5">
      {cells.map((cell, index) => (
        <div
          key={cell.label}
          className={cn('mri-fade-up rounded-xl border bg-mri-surface px-[18px] py-4', cell.border)}
          style={{ animationDelay: `${(0.06 + index * 0.05).toFixed(2)}s` }}
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[9.5px] font-semibold uppercase tracking-[0.13em] text-mri-text2">
              {cell.label}
            </span>
            <span
              aria-hidden="true"
              className={cn('size-[7px] flex-none rounded-full', cell.dot)}
            />
          </div>
          <span
            className={cn(
              'font-mono text-[27px] font-bold leading-none tabular-nums',
              cell.valueClass,
            )}
          >
            {cell.value}
          </span>
        </div>
      ))}
    </div>
  )
}
