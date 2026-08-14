import { intakeChecklistItemsDisplayOptions, intakeOrderDetailOptions } from '@mr/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { InternalPage } from '~/components/layout/internal-page'
import { IntakeHandoverScreen } from '~/features/intake-orders/handover/handover-screen'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'
import { ensureFound } from '~/lib/ensure-found'

/**
 * `$id_`, not `$id`: the trailing underscore keeps this out of the detail route's tree, so the
 * handover is a screen of its own rather than something rendered underneath the detail's tabs.
 *
 * The permission guard lives on `_shell/prijem.tsx` and covers this like every other child. The
 * two actions here are gated by the server (`intake_orders.advance` / `.change_status`); the screen
 * only decides what to show.
 */
export const Route = createFileRoute('/_shell/prijem/$id_/primopredaja')({
  loader: async ({ context: { queryClient }, params: { id } }) => {
    await Promise.all([
      ensureFound(queryClient.ensureQueryData(intakeOrderDetailOptions(id))),
      // The checklist names the condition card reads back. Awaited, like the detail's: the owner is
      // standing here reading what he signed for, and a column of bare codes is not that.
      queryClient.ensureQueryData(intakeChecklistItemsDisplayOptions()),
    ])
  },
  component: IntakeHandoverPage,
})

const rootRoute = getRouteApi('__root__')

function IntakeHandoverPage(): ReactElement {
  const { id } = Route.useParams()
  const { data: order } = useSuspenseQuery(intakeOrderDetailOptions(id))
  const { authSession } = rootRoute.useRouteContext()
  // Whoever is standing at the car, which is why it is the session and not `order.technicianName`.
  const { userName } = useInternalAuthUser()

  return (
    <InternalPage>
      <IntakeHandoverScreen
        order={order}
        technicianName={userName}
        canSkip={(authSession?.user?.permissions ?? []).includes('intake_orders.change_status')}
      />
    </InternalPage>
  )
}
