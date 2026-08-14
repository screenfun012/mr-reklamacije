import {
  intakeChecklistItemsDisplayOptions,
  IntakeDetailSearchSchema,
  IntakeDetailTab,
  intakeOrderDetailOptions,
} from '@mr/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi, useNavigate } from '@tanstack/react-router'
import { useState, type ReactElement } from 'react'

import { InternalPage } from '~/components/layout/internal-page'
import {
  IntakeDetailError,
  IntakeDetailNotFound,
  IntakeDetailPending,
} from '~/features/intake-orders/detail/intake-detail-boundaries'
import { IntakeDetailHeader } from '~/features/intake-orders/detail/intake-detail-header'
import {
  IntakeDetailTabs,
  visibleIntakeDetailTab,
} from '~/features/intake-orders/detail/intake-detail-tabs'
import { IntakeDraftBar } from '~/features/intake-orders/detail/intake-draft-bar'
import { IntakePrintDialog } from '~/features/intake-orders/print/intake-print-dialog'
import { IntakePhotosPendingNote } from '~/features/intake-orders/detail/intake-photos-pending-note'
import { IntakeStatusBar } from '~/features/intake-orders/detail/intake-status-bar'
import { TabHistory } from '~/features/intake-orders/detail/tab-history'
import { TabOverview } from '~/features/intake-orders/detail/tab-overview'
import { TabPhotos } from '~/features/intake-orders/detail/tab-photos'
import { TabSpec } from '~/features/intake-orders/detail/tab-spec'
import { useConsumePrintFlag } from '~/features/intake-orders/detail/use-consume-print-flag'
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
    await Promise.all([
      ensureFound(queryClient.ensureQueryData(intakeOrderDetailOptions(id))),
      // The checklist names, for the condition card and the printed sheet. The DISPLAY read, so a
      // row whose item the shop retired keeps its name (plan D3) — and awaited, because printing is
      // one tap away and a sheet of bare codes is not something to hand a customer.
      queryClient.ensureQueryData(intakeChecklistItemsDisplayOptions()),
    ])
  },
  component: IntakeDetailPage,
  pendingComponent: IntakeDetailPending,
  errorComponent: IntakeDetailError,
  notFoundComponent: IntakeDetailNotFound,
})

const rootRoute = getRouteApi('__root__')

function IntakeDetailPage(): ReactElement {
  const { id } = Route.useParams()
  const { tab, stampa } = Route.useSearch()
  const { data: order } = useSuspenseQuery(intakeOrderDetailOptions(id))

  const { authSession } = rootRoute.useRouteContext()
  const permissions = authSession?.user?.permissions ?? []
  // The router context carries no user id, only name/email — the live session is the one place
  // it exists on the client (the same source the claim attachments tab reads).
  const { data: session } = authClient.useSession()

  const signed = order.signedAt !== null
  const activeTab = visibleIntakeDetailTab(tab, order.signedAt)

  const navigate = useNavigate()
  const [printOpen, setPrintOpen] = useState(false)

  useConsumePrintFlag({
    stampa,
    onOpen: () => setPrintOpen(true),
    onClear: () =>
      void navigate({
        to: '/prijem/$id',
        params: { id },
        search: { ...(tab === undefined ? {} : { tab }) },
        replace: true,
      }),
  })

  return (
    <InternalPage className="flex flex-col gap-[15px]">
      <IntakeDetailHeader
        order={order}
        canAdvance={permissions.includes('intake_orders.advance')}
        canChangeStatus={permissions.includes('intake_orders.change_status')}
        onPrint={() => setPrintOpen(true)}
      />

      {signed ? null : (
        <IntakeDraftBar
          order={order}
          currentUserId={session?.user?.id}
          canDelete={permissions.includes('intake_orders.delete')}
        />
      )}

      {/* Structurally signed-only: `photos_expected` is written by the sign call and nowhere else,
          so this can never fire on a draft and never stacks with the bar above. */}
      {order.photosPending > 0 ? <IntakePhotosPendingNote order={order} /> : null}

      {signed && permissions.includes('intake_orders.change_status') ? (
        <IntakeStatusBar order={order} />
      ) : null}

      <IntakeDetailTabs order={order} activeTab={activeTab} />

      {/* A map, not a ternary chain — `visibleIntakeDetailTab` has already reduced `tab` to one a
          draft is allowed to show, so every key here is reachable and none is a fallthrough. Only
          the selected element is rendered; the other three are never mounted. */}
      {
        {
          [IntakeDetailTab.Pregled]: (
            <TabOverview
              order={order}
              canUpdate={permissions.includes('intake_orders.update')}
              canSendDocument={permissions.includes('intake_orders.send_document')}
            />
          ),
          [IntakeDetailTab.Fotografije]: <TabPhotos order={order} />,
          [IntakeDetailTab.Spec]: (
            <TabSpec order={order} canUpdate={permissions.includes('intake_orders.update')} />
          ),
          [IntakeDetailTab.Istorija]: <TabHistory orderId={order.id} />,
        }[activeTab]
      }

      <IntakePrintDialog order={order} open={printOpen} onClose={() => setPrintOpen(false)} />
    </InternalPage>
  )
}
