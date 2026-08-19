import { m } from '@mr/i18n'
import { ClaimKind, type DashboardListItem } from '@mr/shared'
import type { ReactElement } from 'react'

import { DashCard, DashCardMeta, DashEmpty, DashRow } from './dash-card'

/** The claim number, in mono — it is an identifier, and identifiers line up. */
function MrNumber({ value }: { value: string | null }): ReactElement {
  return (
    <span className="flex-none font-mono text-[12px] font-semibold text-foreground">
      {value ?? '—'}
    </span>
  )
}

function KindBadge({ kind }: { kind: DashboardListItem['kind'] }): ReactElement {
  const emotive = kind === ClaimKind.Emotive
  return (
    <span
      className={`flex-none rounded-full px-[7px] py-[3px] font-mono text-[8.5px] font-semibold uppercase ${
        emotive ? 'bg-adm-blu/15 text-adm-blu' : 'bg-adm-pur/15 text-adm-pur'
      }`}
    >
      {emotive ? m.dashboard_card_emotive() : m.dashboard_chart_domace()}
    </span>
  )
}

function CustomerLabel({ value }: { value: string | null }): ReactElement {
  return <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">{value}</span>
}

export interface ClaimListCardProps {
  items: readonly DashboardListItem[]
}

/** What came in last. The kind badge is the only colour: EMOTIVE blue, DOMAĆE purple, as the chart. */
export function RecentClaimsCard({ items }: ClaimListCardProps): ReactElement {
  return (
    <DashCard title={m.dashboard_recent_title()}>
      {items.length === 0 ? (
        <DashEmpty>{m.dashboard_recent_empty()}</DashEmpty>
      ) : (
        items.map((item) => (
          <DashRow key={`${item.kind}-${item.id}`}>
            <MrNumber value={item.mrNumber} />
            <KindBadge kind={item.kind} />
            <CustomerLabel value={item.customerLabel} />
            <span className="flex-none font-mono text-[10.5px] font-medium text-muted-foreground">
              {m.dashboard_days_short({ days: item.daysOpen })}
            </span>
          </DashRow>
        ))
      )}
    </DashCard>
  )
}

/**
 * What has been open longest. Here the days ARE the news, so they carry the only red on the
 * dashboard — a claim sitting for six weeks is the one figure on this screen that means something
 * is wrong.
 */
export function OverdueClaimsCard({ items }: ClaimListCardProps): ReactElement {
  return (
    <DashCard
      title={m.dashboard_overdue_title()}
      meta={<DashCardMeta>{m.dashboard_overdue_hint().toUpperCase()}</DashCardMeta>}
    >
      {items.length === 0 ? (
        <DashEmpty>{m.dashboard_overdue_empty()}</DashEmpty>
      ) : (
        items.map((item) => (
          <DashRow key={`${item.kind}-${item.id}`}>
            <MrNumber value={item.mrNumber} />
            <CustomerLabel value={item.customerLabel} />
            <span className="flex-none rounded-full bg-mr-brand/[0.13] px-[9px] py-[3px] font-mono text-[10.5px] font-bold text-adm-red-h">
              {m.dashboard_overdue_days({ days: item.daysOpen })}
            </span>
          </DashRow>
        ))
      )}
    </DashCard>
  )
}
