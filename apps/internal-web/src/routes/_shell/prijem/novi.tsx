import { createFileRoute } from '@tanstack/react-router'

import { IntakeWizard } from '~/features/intake-orders/wizard/intake-wizard'
import { internalRequireIntakeOrdersCreate } from '~/lib/auth-guard'

/**
 * Steps 1–2 are built (docs/25 V-3); 3–5 walk into a reserved panel until their phases land,
 * so the flow is walkable end to end and the stepper never lies about how many steps exist.
 */
export const Route = createFileRoute('/_shell/prijem/novi')({
  beforeLoad: internalRequireIntakeOrdersCreate(),
  component: IntakeWizard,
})
