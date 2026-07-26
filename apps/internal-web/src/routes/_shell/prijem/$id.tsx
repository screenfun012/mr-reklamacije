import { m } from '@mr/i18n'
import { createFileRoute } from '@tanstack/react-router'

import { IntakePhasePlaceholder } from '~/features/intake-orders/intake-phase-placeholder'

/** The 4-tab detail lands in V-6; the route is reserved so every list row is clickable. */
export const Route = createFileRoute('/_shell/prijem/$id')({
  component: () => <IntakePhasePlaceholder title={m.intake_detail_title()} />,
})
