export const WIZARD_STEPS = [
  'basic',
  'faults',
  // 'attachments', // Phase 1.3 — between faults and review
  'review',
] as const

export type WizardStep = (typeof WIZARD_STEPS)[number]

export function wizardStepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step)
}

export function nextWizardStep(step: WizardStep): WizardStep | null {
  const index = wizardStepIndex(step)
  const next = WIZARD_STEPS[index + 1]
  return next ?? null
}

export function previousWizardStep(step: WizardStep): WizardStep | null {
  const index = wizardStepIndex(step)
  if (index <= 0) {
    return null
  }
  return WIZARD_STEPS[index - 1] ?? null
}
