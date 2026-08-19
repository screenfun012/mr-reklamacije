import { m } from '@mr/i18n'
import {
  panelClassName,
  panelHeaderClassName,
  panelMetaClassName,
  panelTitleClassName,
} from '@mr/ui'
import type { ReactElement } from 'react'

export interface TopFaultsCardProps {
  /** `null` when the reader may not see named blame — the card then does not exist. */
  rows: readonly { employeeId: string; name: string; faultCount: number }[] | null
}

/**
 * Renders NOTHING when `rows` is `null`. "You may not see this" is not news a screen should
 * announce — an empty state there would tell every reader that named blame exists and is being
 * withheld from them.
 */
export function TopFaultsCard({ rows }: TopFaultsCardProps): ReactElement | null {
  if (rows === null) {
    return null
  }

  const highest = rows[0]?.faultCount ?? 0

  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>{m.admin_dashboard_top_faults()}</h2>
        {/* A COUNT, never a rate. `employee_monthly_output` — how many engines a worker assembled —
            exists since migration 0004 and nothing has ever written it, so any percentage here
            would be divided by zero. */}
        <span className={panelMetaClassName}>{m.admin_dashboard_top_faults_hint()}</span>
      </div>
      <div className="flex flex-col gap-2 p-5">
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {m.admin_dashboard_recent_changes_empty()}
          </p>
        ) : (
          rows.map((row) => (
            <div key={row.employeeId} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{row.name}</span>
              <span
                aria-hidden="true"
                className="h-1.5 flex-[2] overflow-hidden rounded-full bg-muted"
              >
                <span
                  className="block h-full rounded-full bg-mr-brand/60"
                  style={{
                    width: `${String(highest === 0 ? 0 : (row.faultCount / highest) * 100)}%`,
                  }}
                />
              </span>
              <span className="w-8 flex-none text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                {row.faultCount}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
