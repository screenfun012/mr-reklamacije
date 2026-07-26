import { m } from '@mr/i18n'
import { createFileRoute } from '@tanstack/react-router'

import { IntakePhasePlaceholder } from '~/features/intake-orders/intake-phase-placeholder'
import { internalRequireIntakeOrdersCreate } from '~/lib/auth-guard'

/** The 5-step wizard lands in V-3…V-5; the route is reserved so the list's CTA leads somewhere. */
export const Route = createFileRoute('/_shell/prijem/novi')({
  beforeLoad: internalRequireIntakeOrdersCreate(),
  component: () => <IntakePhasePlaceholder title={m.intake_new_order()} />,
})
