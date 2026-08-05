import { m } from '@mr/i18n'
import {
  ApiError,
  IntakeDetailSearchSchema,
  IntakeDetailTab,
  intakeOrderDetailOptions,
} from '@mr/shared'
import { Skeleton } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { InternalPage } from '~/components/layout/internal-page'
import { IntakeDetailHeader } from '~/features/intake-orders/detail/intake-detail-header'
import {
  IntakeDetailTabs,
  visibleIntakeDetailTab,
} from '~/features/intake-orders/detail/intake-detail-tabs'
import { IntakeDraftBar } from '~/features/intake-orders/detail/intake-draft-bar'
import { IntakePhotosPendingNote } from '~/features/intake-orders/detail/intake-photos-pending-note'
import { IntakeRemovedBar } from '~/features/intake-orders/detail/intake-removed-bar'
import { IntakeStatusBar } from '~/features/intake-orders/detail/intake-status-bar'
import { TabOverview } from '~/features/intake-orders/detail/tab-overview'
import { authClient } from '~/lib/auth-client'

/**
 * The permission guard lives on the parent layout route (`_shell/prijem.tsx`) and covers every
 * child — the detail needs nothing the list does not, and a second `beforeLoad` would resolve
 * the session twice per server-rendered open.
 */
export const Route = createFileRoute('/_shell/prijem/$id')({
  validateSearch: (search) => IntakeDetailSearchSchema.parse(search),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    // One aggregate fetch. The history is one tab out of four and loads when that tab mounts.
    await queryClient.ensureQueryData(intakeOrderDetailOptions(id))
  },
  component: IntakeDetailPage,
  pendingComponent: IntakeDetailPending,
  errorComponent: IntakeDetailError,
})

const rootRoute = getRouteApi('__root__')

function IntakeDetailPage(): ReactElement {
  const { id } = Route.useParams()
  const { tab } = Route.useSearch()
  const { data: order } = useSuspenseQuery(intakeOrderDetailOptions(id))

  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  // The router context carries no user id, only name/email — the live session is the one place
  // it exists on the client (the same source the claim attachments tab reads).
  const { data: session } = authClient.useSession()

  const isLive = order.deletedAt === null && order.signedAt !== null
  const activeTab = visibleIntakeDetailTab(tab, order.signedAt)

  return (
    <InternalPage className="flex flex-col gap-[15px]">
      <IntakeDetailHeader
        order={order}
        canAdvance={permissions.includes('intake_orders.advance')}
        canDelete={permissions.includes('intake_orders.delete')}
        canChangeStatus={permissions.includes('intake_orders.change_status')}
      />

      {order.deletedAt !== null ? (
        <IntakeRemovedBar order={order} canDelete={permissions.includes('intake_orders.delete')} />
      ) : null}

      {order.signedAt === null ? (
        <IntakeDraftBar
          order={order}
          currentUserId={session?.user?.id}
          canDelete={permissions.includes('intake_orders.delete')}
        />
      ) : null}

      {/* Structurally signed-only: `photos_expected` is written by the sign call and nowhere else,
          so this can never fire on a draft and never stacks with the bar above. Removed orders are
          excluded on purpose — the server refuses every upload to one, and removal never clears the
          expectation, so it would ask forever for something nobody can do. */}
      {order.deletedAt === null && order.photosPending > 0 ? (
        <IntakePhotosPendingNote order={order} />
      ) : null}

      {isLive && permissions.includes('intake_orders.change_status') ? (
        <IntakeStatusBar order={order} />
      ) : null}

      <IntakeDetailTabs order={order} activeTab={activeTab} />

      {/* The other three tab bodies mount here — docs/25 V-6-1b, task 11. */}
      {activeTab === IntakeDetailTab.Pregled ? <TabOverview order={order} /> : null}
    </InternalPage>
  )
}

function BackLink(): ReactElement {
  return (
    <Link to="/prijem" className="font-mono text-[11px] text-mri-text2 hover:text-mri-text">
      {m.intake_detail_back()}
    </Link>
  )
}

function IntakeDetailPending(): ReactElement {
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

function IntakeDetailError({ error }: { error: Error }): ReactElement {
  const isNotFound = error instanceof ApiError && error.status === 404

  return (
    <InternalPage className="flex flex-col gap-[15px]">
      <BackLink />
      <div
        className="rounded-[12px] border border-mri-bad/40 bg-mri-bad-bg px-4 py-10 text-center"
        role="alert"
      >
        <p className="font-semibold text-mri-text">
          {isNotFound ? m.intake_detail_not_found_title() : m.intake_detail_error_title()}
        </p>
        {isNotFound ? (
          <p className="mt-1 text-mri-text2">{m.intake_detail_not_found_body()}</p>
        ) : null}
      </div>
    </InternalPage>
  )
}
