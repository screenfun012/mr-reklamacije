import { getLocale, m } from '@mr/i18n'
import { intakeOrderHistoryOptions, type IntakeOrderHistoryEntry } from '@mr/shared'
import { Skeleton, cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import type { ReactElement } from 'react'

import { IntakeErrorState } from '../intake-error-state'
import { formatIntakeHistoryAt } from '../intake-status'
import { CAPTION, CARD, DASH } from './detail-styles'
import { historyLabel } from './history-labels'

const ROW = 'flex gap-4 border-b border-mri-border py-3'

function HistoryRow({ entry }: { entry: IntakeOrderHistoryEntry }): ReactElement {
  return (
    <div className={ROW}>
      <span className="w-[130px] flex-none font-mono text-[12px] font-medium text-mri-text2">
        {formatIntakeHistoryAt(entry.at, getLocale())}
      </span>
      <span className="min-w-0 flex-1 text-[14px] text-mri-text">{historyLabel(entry)}</span>
      {/* A deleted user leaves the row without a name — a dash, never a blank column. */}
      <span className="text-[13px] text-mri-text2">{entry.actorName ?? DASH}</span>
    </div>
  )
}

function HistorySkeleton(): ReactElement {
  return (
    <div aria-busy="true">
      {[0, 1, 2].map((row) => (
        <div key={row} className={ROW}>
          <Skeleton className="h-4 w-[130px] flex-none" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  )
}

/**
 * Who changed this after the customer signed — the whole reason the tab exists, which is why the
 * projection drops the intake being filled in (spec §6.1). Newest first, straight from the server.
 *
 * `useQuery` and not the house `useSuspenseQuery`, deliberately: both of this fetch's failure modes
 * have to stay INSIDE this card. A suspense query hands its pending state to the nearest boundary —
 * the route's `pendingComponent`, which blanks the header, both bars and the tab strip on every
 * switch to Istorija — and hands its rejection to the route's `errorComponent`, so one flaky fetch
 * for a secondary tab would replace the three tabs that DO work with a red box whose only exit is
 * the back link.
 *
 * A local `<Suspense>` plus a `<CatchBoundary>` was tried first and the retry button is dead there:
 * React Query sets `retryOnMount = false` while its own error-reset boundary is unreset
 * (`errorBoundaryUtils.js:8`), so resetting the catch boundary — however it is triggered, including
 * `router.invalidate()` — remounts the rows and re-throws the SAME error without a request going
 * out. Measured 2026-08-08. `refetch()` is the lever that actually refetches, and `useQuery` is what
 * puts it in reach.
 */
export function TabHistory({ orderId }: { orderId: string }): ReactElement {
  const history = useQuery(intakeOrderHistoryOptions(orderId))

  return (
    <section className={cn(CARD, 'flex flex-col px-[22px] py-5')}>
      <h2 className={cn(CAPTION, 'mb-3.5')}>{m.intake_tab_istorija()}</h2>

      {history.isError ? (
        <IntakeErrorState
          title={m.intake_detail_error_title()}
          description={null}
          canRetry
          onRetry={() => {
            void history.refetch()
          }}
        />
      ) : null}

      {/* A skeleton, not nothing: an empty card would read as "this order has no history". */}
      {history.isPending ? <HistorySkeleton /> : null}

      {history.data?.map((entry) => (
        <HistoryRow key={entry.id} entry={entry} />
      ))}
    </section>
  )
}
