import { m } from '@mr/i18n'

import { step1Missing, type IntakeStep1Field, type IntakeWizardValues } from './intake-wizard-state'

/**
 * What the footer calls a missing field — the label printed on the card, not a synonym, so the eye
 * lands on the row it names. The ID field is labelled per owner type on screen, but only a private
 * person's is ever required, so only that name can appear here.
 */
const STEP1_FIELD_LABELS: Record<IntakeStep1Field, () => string> = {
  orderNumber: () => m.intake_field_order_number(),
  plate: () => m.intake_field_plate(),
  vehicle: () => m.intake_field_vehicle(),
  ownerName: () => m.intake_field_owner_name(),
  ownerIdNumber: () => m.intake_field_owner_id_card(),
  ownerPhone: () => m.intake_field_owner_phone(),
}

/**
 * The fields still holding DALJE, named. Empty string when nothing is.
 *
 * A list of nouns rather than a built sentence: the message around it carries the grammar, so no
 * form here depends on how many there are.
 */
export function step1MissingLabels(values: IntakeWizardValues): string {
  return step1Missing(values)
    .map((field) => STEP1_FIELD_LABELS[field]())
    .join(', ')
}
