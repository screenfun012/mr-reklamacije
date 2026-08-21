import { m } from '@mr/i18n'

/**
 * The four steps of the prototype's wizard. `kind` is first because it decides what the rest
 * asks for — and because a claim that has been saved can never change kind, so this is the one
 * moment it is a question at all.
 */
export const CLAIM_WIZARD_STEPS = ['kind', 'basic', 'faults', 'review'] as const

export type ClaimWizardStep = (typeof CLAIM_WIZARD_STEPS)[number]

/** The strip's short labels — VRSTA · PODACI · KVAROVI · PREGLED (prototype §5). */
const STEP_LABELS: Record<ClaimWizardStep, () => string> = {
  kind: m.claim_wizard_step_kind,
  basic: m.claim_wizard_step_basic,
  faults: m.claim_wizard_step_faults,
  review: m.claim_wizard_step_review,
}

export function claimWizardStepLabel(step: ClaimWizardStep): string {
  return STEP_LABELS[step]()
}

/**
 * The page's own H1, which is not the strip's label: the first step is "Izbor vrste" while its
 * dot reads "VRSTA" (prototype §5).
 */
const STEP_TITLES: Record<ClaimWizardStep, () => string> = {
  ...STEP_LABELS,
  kind: m.claim_wizard_step_kind_title,
}

export function claimWizardStepTitle(step: ClaimWizardStep): string {
  return STEP_TITLES[step]()
}

export function claimWizardStepIndex(step: ClaimWizardStep): number {
  return CLAIM_WIZARD_STEPS.indexOf(step)
}

export function nextClaimWizardStep(step: ClaimWizardStep): ClaimWizardStep | null {
  return CLAIM_WIZARD_STEPS[claimWizardStepIndex(step) + 1] ?? null
}

export function previousClaimWizardStep(step: ClaimWizardStep): ClaimWizardStep | null {
  const index = claimWizardStepIndex(step)
  return index <= 0 ? null : (CLAIM_WIZARD_STEPS[index - 1] ?? null)
}
