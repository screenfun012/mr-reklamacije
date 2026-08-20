import { m } from '@mr/i18n'
import { formatChartMonth, type DashboardChartMonth } from '@mr/shared'
import { useLocale } from '@mr/ui'
import type { ReactElement } from 'react'

import { DashCard, DashCardMeta } from './dash-card'

export interface ClaimsTrendCardProps {
  months: readonly DashboardChartMonth[]
}

function Legend({
  className,
  label,
  value,
}: {
  className: string
  label: string
  /** Only the hover card carries figures; the strip beside the title is a key, not a reading. */
  value?: number
}): ReactElement {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
      <span aria-hidden="true" className={`size-2 rounded-[3px] ${className}`} />
      {label}
      {value === undefined ? null : <span className="text-foreground">{value}</span>}
    </span>
  )
}

/**
 * Twenty-four columns across, a centred hover card would hang off the ends of the plot. Those two
 * hang from their own edge instead.
 */
function hoverCardAlignClassName(index: number, count: number): string {
  if (index === 0) return 'left-0'
  if (index === count - 1) return 'right-0'
  return 'left-1/2 -translate-x-1/2'
}

/**
 * Two years of claims per month, EMOTIVE stacked under DOMAĆE.
 *
 * Drawn with divs rather than recharts, which internal-web uses for its own chart: this is a
 * stacked bar with no axes, and the library would ship 140 KB to lay out twenty-four rectangles.
 * The heights are percentages of the busiest month, so the tallest bar always reaches the top of
 * the plot and the shape stays readable whatever the volume.
 *
 * The figures come out on hover, in a card of our own. The `title` attribute this used to carry
 * was drawn by the operating system a second or two late and read as nothing happening at all
 * (Nikola, 2026-08-20) — it is now an `aria-label`, which a screen reader announces and no
 * pointer ever waits on.
 */
export function ClaimsTrendCard({ months }: ClaimsTrendCardProps): ReactElement {
  const { locale } = useLocale()
  const highest = months.reduce((max, month) => Math.max(max, month.total), 0)

  return (
    <DashCard
      title={m.dashboard_chart_title()}
      titleAfter={
        <div className="flex flex-wrap items-center gap-3.5">
          <Legend className="bg-adm-blu" label={m.dashboard_card_emotive()} />
          <Legend className="bg-adm-pur" label={m.dashboard_chart_domace()} />
        </div>
      }
      meta={<DashCardMeta>{m.dashboard_chart_window_24m().toUpperCase()}</DashCardMeta>}
      className="min-w-0"
    >
      <div className="flex min-h-[190px] flex-1 items-end gap-[5px]">
        {months.map((month, index) => {
          const emotiveHeight = highest === 0 ? 0 : (month.emotive / highest) * 100
          const domaceHeight = highest === 0 ? 0 : (month.domace / highest) * 100
          const label = formatChartMonth(month.month, locale)

          return (
            <div
              key={month.month}
              role="img"
              aria-label={`${label} · ${m.dashboard_card_emotive()}: ${String(month.emotive)} · ${m.dashboard_chart_domace()}: ${String(month.domace)}`}
              className="group relative flex h-full flex-1 flex-col justify-end gap-[2px] rounded-[4px] transition-colors hover:bg-foreground/5"
            >
              {/* Inside the plot, not above it: the card does not clip, so a hover card hung over
                  the top edge would cover the chart's own name and reach into the card beside it. */}
              <div
                className={`pointer-events-none absolute top-0 z-10 hidden flex-col gap-1 whitespace-nowrap rounded-[10px] border border-border bg-adm-raised px-3 py-2 shadow-[0_10px_28px_rgba(0,0,0,0.28)] group-hover:flex ${hoverCardAlignClassName(index, months.length)}`}
              >
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {label}
                </span>
                <Legend
                  className="bg-adm-blu"
                  label={m.dashboard_card_emotive()}
                  value={month.emotive}
                />
                <Legend
                  className="bg-adm-pur"
                  label={m.dashboard_chart_domace()}
                  value={month.domace}
                />
              </div>

              {month.domace > 0 ? (
                <span
                  className="block rounded-t-[3px] bg-adm-pur/90"
                  style={{ height: `${String(domaceHeight)}%` }}
                />
              ) : null}
              {month.emotive > 0 ? (
                <span
                  className={`block bg-adm-blu ${month.domace > 0 ? '' : 'rounded-t-[3px]'}`}
                  style={{ height: `${String(emotiveHeight)}%` }}
                />
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="flex gap-[5px]">
        {months.map((month, index) => (
          <span
            key={month.month}
            className="flex-1 text-center font-mono text-[8px] font-medium text-muted-foreground"
          >
            {/* Every other bucket: twenty-four labels in this width overlap into a grey smear. */}
            {index % 2 === 0 ? formatChartMonth(month.month, locale) : ''}
          </span>
        ))}
      </div>
    </DashCard>
  )
}
