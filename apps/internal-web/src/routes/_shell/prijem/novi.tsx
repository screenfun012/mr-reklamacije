import { intakeChecklistItemsReferenceOptions, IntakeWizardSearchSchema } from '@mr/shared'
import { createFileRoute } from '@tanstack/react-router'
import type { ReactElement } from 'react'

import { IntakeWizard } from '~/features/intake-orders/wizard/intake-wizard'
import { internalRequireIntakeOrdersCreate } from '~/lib/auth-guard'

/**
 * Steps 1–2 are built (docs/25 V-3); 3–5 walk into a reserved panel until their phases land,
 * so the flow is walkable end to end and the stepper never lies about how many steps exist.
 */
export const Route = createFileRoute('/_shell/prijem/novi')({
  beforeLoad: internalRequireIntakeOrdersCreate(),
  validateSearch: (search) => IntakeWizardSearchSchema.parse(search),
  loader: async ({ context: { queryClient } }) => {
    // Awaited, not fired and forgotten: step 2 draws this catalog, and the very first step patch
    // records a row per item in it. Half a wizard is worse than a wizard that says it cannot open.
    await queryClient.ensureQueryData(intakeChecklistItemsReferenceOptions({ activeOnly: true }))
  },
  component: NewIntakePage,
})

function NewIntakePage(): ReactElement {
  const { resume } = Route.useSearch()
  // Spread rather than pass `undefined`: `exactOptionalPropertyTypes` treats an explicit
  // undefined as a different thing from an absent prop.
  return <IntakeWizard {...(resume === undefined ? {} : { resumeOrderId: resume })} />
}
