import { m } from '@mr/i18n'
import { Skeleton } from '@mr/ui'
import { Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { InternalPage } from '~/components/layout/internal-page'
import { IntakeErrorState } from '../intake-error-state'

/**
 * The three states every screen that opens ONE order shares — the detail and the handover.
 *
 * They live here rather than in either route because importing a route module from another route
 * drags its whole screen into the other one's chunk: the detail pulls four tabs, the print dialog
 * and the damage map, none of which a handover needs to say "loading".
 */
function BackLink(): ReactElement {
  return (
    <Link to="/prijem" className="font-mono text-[11px] text-mri-text2 hover:text-mri-text">
      {m.intake_detail_back()}
    </Link>
  )
}

export function IntakeDetailPending(): ReactElement {
  return (
    <InternalPage className="flex flex-col gap-[15px]">
      <div className="flex flex-wrap items-start gap-4" aria-busy="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="ml-auto flex gap-2.5">
          <Skeleton className="h-[46px] w-28" />
          <Skeleton className="h-[46px] w-36" />
        </div>
      </div>
      <div className="flex gap-6 border-b border-mri-border pb-3">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-20" />
      </div>
    </InternalPage>
  )
}

/**
 * A missing order is a NOT-FOUND, not an error, and the loaders turn it into one (`ensureFound`) so
 * this screen is reached identically on a hard load and on a client-side navigation. It used to be
 * decided from the error's status, which is gone by the time SSR hands it over — so a pasted link
 * answered "could not be loaded" and offered a retry that could not work.
 */
export function IntakeDetailNotFound(): ReactElement {
  return (
    <InternalPage className="flex flex-col gap-[15px]">
      <BackLink />
      {/* No retry: the order is not there, and asking again cannot change that. */}
      <IntakeErrorState
        title={m.intake_detail_not_found_title()}
        description={m.intake_detail_not_found_body()}
        canRetry={false}
      />
    </InternalPage>
  )
}

export function IntakeDetailError(): ReactElement {
  return (
    <InternalPage className="flex flex-col gap-[15px]">
      <BackLink />
      <IntakeErrorState title={m.intake_detail_error_title()} description={null} canRetry />
    </InternalPage>
  )
}
