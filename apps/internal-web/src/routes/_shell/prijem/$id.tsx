import { m } from '@mr/i18n'
import { IntakeDetailSearchSchema, IntakeDetailTab, intakeOrderDetailOptions } from '@mr/shared'
import { ConfirmDialog, Skeleton } from '@mr/ui'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { InternalPage } from '~/components/layout/internal-page'
import { IntakeAmendBar } from '~/features/intake-orders/detail/intake-amend-bar'
import { IntakeDetailHeader } from '~/features/intake-orders/detail/intake-detail-header'
import {
  IntakeDetailTabs,
  visibleIntakeDetailTab,
} from '~/features/intake-orders/detail/intake-detail-tabs'
import { IntakeDraftBar } from '~/features/intake-orders/detail/intake-draft-bar'
import { IntakePhotosPendingNote } from '~/features/intake-orders/detail/intake-photos-pending-note'
import { IntakeRemovedBar } from '~/features/intake-orders/detail/intake-removed-bar'
import { IntakeStatusBar } from '~/features/intake-orders/detail/intake-status-bar'
import { TabHistory } from '~/features/intake-orders/detail/tab-history'
import { TabOverview } from '~/features/intake-orders/detail/tab-overview'
import { TabPhotos } from '~/features/intake-orders/detail/tab-photos'
import { TabSpec } from '~/features/intake-orders/detail/tab-spec'
import { useIntakeAmend } from '~/features/intake-orders/detail/use-intake-amend'
import { IntakeErrorState } from '~/features/intake-orders/intake-error-state'
import { authClient } from '~/lib/auth-client'
import { ensureFound } from '~/lib/ensure-found'

/**
 * The permission guard lives on the parent layout route (`_shell/prijem.tsx`) and covers every
 * child — the detail needs nothing the list does not, and a second `beforeLoad` would resolve
 * the session twice per server-rendered open.
 */
export const Route = createFileRoute('/_shell/prijem/$id')({
  validateSearch: (search) => IntakeDetailSearchSchema.parse(search),
  loader: async ({ context: { queryClient }, params: { id } }) => {
    // One aggregate fetch. The history is one tab out of four and loads when that tab mounts.
    await ensureFound(queryClient.ensureQueryData(intakeOrderDetailOptions(id)))
  },
  component: IntakeDetailPage,
  pendingComponent: IntakeDetailPending,
  errorComponent: IntakeDetailError,
  notFoundComponent: IntakeDetailNotFound,
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

  const navigate = useNavigate()
  const amend = useIntakeAmend(order)

  /**
   * The mode is entered from a button that every tab can see, but the buffer only has a body to
   * live in on Pregled — so the move is explicit. `replace`, like the tab strip itself, so Back
   * still leaves the order rather than walking through modes.
   */
  const startAmend = (): void => {
    void navigate({
      to: '/prijem/$id',
      params: { id },
      search: { tab: IntakeDetailTab.Pregled },
      replace: true,
    })
    amend.start()
  }

  return (
    <InternalPage className="flex flex-col gap-[15px]">
      <IntakeDetailHeader
        order={order}
        canAdvance={permissions.includes('intake_orders.advance')}
        canDelete={permissions.includes('intake_orders.delete')}
        canChangeStatus={permissions.includes('intake_orders.change_status')}
        canAmend={permissions.includes('intake_orders.amend')}
        amendActive={amend.active}
        onStartAmend={startAmend}
      />

      {amend.active ? (
        <IntakeAmendBar
          onCancel={amend.cancel}
          onSave={amend.requestSave}
          pending={amend.pending}
        />
      ) : null}

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

      {/* Hidden while the mode is open, not disabled: every segment fires immediately and would
          leave the unsaved buffer behind a status the operator did not mean to move. */}
      {isLive && !amend.active && permissions.includes('intake_orders.change_status') ? (
        <IntakeStatusBar order={order} />
      ) : null}

      <IntakeDetailTabs order={order} activeTab={activeTab} locked={amend.active} />

      {/* A map, not a ternary chain — `visibleIntakeDetailTab` has already reduced `tab` to one a
          draft is allowed to show, so every key here is reachable and none is a fallthrough. Only
          the selected element is rendered; the other three are never mounted. */}
      {
        {
          [IntakeDetailTab.Pregled]: (
            <TabOverview
              order={order}
              {...(amend.active
                ? {
                    amend: {
                      buffer: amend.buffer,
                      patch: amend.patch,
                      phoneValid: amend.phoneValid,
                    },
                  }
                : {})}
            />
          ),
          [IntakeDetailTab.Fotografije]: <TabPhotos order={order} />,
          [IntakeDetailTab.Spec]: (
            <TabSpec order={order} canUpdate={permissions.includes('intake_orders.update')} />
          ),
          [IntakeDetailTab.Istorija]: <TabHistory orderId={order.id} />,
        }[activeTab]
      }

      {/* Asked once, on Sačuvaj (decision ②), and it says what the mark means — the operator is
          about to change a document a customer signed and holds a printed copy of. */}
      <ConfirmDialog
        open={amend.confirmOpen}
        onOpenChange={amend.setConfirmOpen}
        variant="default"
        title={m.intake_amend_confirm_title({ number: order.orderNumber })}
        description={
          amend.losesPhotoNumbers
            ? `${m.intake_amend_confirm_description()} ${m.intake_amend_confirm_photos()}`
            : m.intake_amend_confirm_description()
        }
        confirmLabel={m.intake_amend_confirm_button()}
        pending={amend.pending}
        onConfirm={amend.save}
      />
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

/**
 * A missing order is a NOT-FOUND, not an error, and the loader turns it into one (`ensureFound`) so
 * this screen is reached identically on a hard load and on a client-side navigation. It used to be
 * decided in `IntakeDetailError` from the error's status, which is gone by the time SSR hands it
 * over — so a pasted link answered "could not be loaded" and offered a retry that could not work.
 */
function IntakeDetailNotFound(): ReactElement {
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

function IntakeDetailError(): ReactElement {
  return (
    <InternalPage className="flex flex-col gap-[15px]">
      <BackLink />
      <IntakeErrorState title={m.intake_detail_error_title()} description={null} canRetry />
    </InternalPage>
  )
}
