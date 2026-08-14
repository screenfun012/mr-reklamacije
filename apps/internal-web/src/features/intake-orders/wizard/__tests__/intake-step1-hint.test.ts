import { IntakeOwnerType } from '@mr/shared'
import { describe, expect, it } from 'vitest'

import { step1MissingLabels } from '../intake-step1-hint'
import { emptyIntakeWizardValues, type IntakeWizardValues } from '../intake-wizard-state'

function filledValues(overrides: Partial<IntakeWizardValues> = {}): IntakeWizardValues {
  return {
    ...emptyIntakeWizardValues(),
    orderNumber: 'RN-0249/26',
    plate: 'BG 774-LN',
    vehicle: 'Renault Master',
    ownerName: 'Milan Petrović',
    ownerIdNumber: '008123456',
    ownerPhone: '+381 60 111 2233',
    ...overrides,
  }
}

/** The suite runs in the default locale, English — the labels below are that locale's. */
describe('step1MissingLabels', () => {
  it('names the ID card, the field the old sentence never mentioned', () => {
    // The reported bug, verbatim: everything the footer listed was filled and DALJE stayed dead.
    expect(step1MissingLabels(filledValues({ ownerIdNumber: '' }))).toBe('ID card number')
  })

  it('says nothing when nothing is missing', () => {
    expect(step1MissingLabels(filledValues())).toBe('')
  })

  it('names each empty field by the label on its own row, in form order', () => {
    expect(step1MissingLabels(filledValues({ vehicle: '', ownerPhone: '' }))).toBe(
      'Make and model, Phone',
    )
  })

  it('never asks a firm for an ID card', () => {
    expect(
      step1MissingLabels(filledValues({ ownerType: IntakeOwnerType.Company, ownerIdNumber: '' })),
    ).toBe('')
  })
})
