import { m } from '@mr/i18n'
import { formatChartMonth, type DashboardChartMonth } from '@mr/shared'
import { useLocale } from '@mr/ui'
import type { ReactElement } from 'react'

import { DashCard, DashCardMeta } from './dash-card'

export interface ClaimsTrendCardProps {
  months: readonly DashboardChartMonth[]
}

function Legend({ className, label }: { className: string; label: string }): ReactElement {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold text-muted-foreground">
      <span aria-hidden="true" className={`size-2 rounded-[3px] ${className}`} />
      {label}
    </span>
  )
}

/**
 * Two years of claims per month, EMOTIVE stacked under DOMAĆE.
 *
 * Drawn with divs rather than recharts, which internal-web uses for its own chart: this is a
 * stacked bar with no axes, no tooltip and no interaction, and the library would ship 140 KB to
 * lay out twenty-four rectangles. The heights are percentages of the busiest month, so the tallest
 * bar always reaches the top of the plot and the shape stays readable whatever the volume.
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
        {months.map((month) => {
          const emotiveHeight = highest === 0 ? 0 : (month.emotive / highest) * 100
          const domaceHeight = highest === 0 ? 0 : (month.domace / highest) * 100

          return (
            <div
              key={month.month}
              className="flex h-full flex-1 flex-col justify-end gap-[2px]"
              title={`${formatChartMonth(month.month, locale)} · ${m.dashboard_card_emotive()}: ${String(month.emotive)} · ${m.dashboard_chart_domace()}: ${String(month.domace)}`}
            >
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
