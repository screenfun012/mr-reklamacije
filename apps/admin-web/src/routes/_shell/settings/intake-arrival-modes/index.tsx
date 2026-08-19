import { m } from '@mr/i18n'
import { createFileRoute } from '@tanstack/react-router'

import { CatalogComingSoon } from '~/components/catalog-coming-soon'

export const Route = createFileRoute('/_shell/settings/intake-arrival-modes/')({
  component: IntakeArrivalModesRoute,
})

function IntakeArrivalModesRoute(): React.ReactElement {
  return <CatalogComingSoon title={m.nav_intake_arrival_modes()} />
}
