import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

import { DashCard, DashEmpty } from './dash-card'

export interface TopFaultsCardProps {
  /** `null` when the reader may not see named blame — the card then does not exist. */
  rows: readonly { employeeId: string; name: string; faultCount: number }[] | null
}

/**
 * Renders NOTHING when `rows` is `null`. "You may not see this" is not news a screen should
 * announce — an empty state there would tell every reader that named blame exists and is being
 * withheld from them.
 *
 * The bars are amber, not red: this is a ranking of where faults were recorded, not an accusation,
 * and red on a person's name reads as one.
 */
export function TopFaultsCard({ rows }: TopFaultsCardProps): ReactElement | null {
  if (rows === null) {
    return null
  }

  const highest = rows[0]?.faultCount ?? 0

  return (
    <DashCard
      title={m.admin_dashboard_top_faults()}
      // A COUNT, never a rate. `employee_monthly_output` — how many engines a worker assembled —
      // exists since migration 0004 and nothing has ever written it, so any percentage here would
      // be divided by zero.
      subtitle={m.admin_dashboard_top_faults_hint()}
      className="flex-1"
    >
      {rows.length === 0 ? (
        <DashEmpty>{m.admin_dashboard_recent_changes_empty()}</DashEmpty>
      ) : (
        rows.map((row) => (
          <div key={row.employeeId} className="flex items-center gap-2.5">
            <span className="w-[120px] flex-none truncate text-[12.5px] text-foreground">
              {row.name}
            </span>
            <span
              aria-hidden="true"
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-adm-inbg"
            >
              <span
                className="block h-full rounded-full bg-adm-amb"
                style={{
                  width: `${String(highest === 0 ? 0 : (row.faultCount / highest) * 100)}%`,
                }}
              />
            </span>
            <span className="w-[18px] flex-none text-right font-mono text-[12px] font-bold tabular-nums text-foreground">
              {row.faultCount}
            </span>
          </div>
        ))
      )}
    </DashCard>
  )
}
