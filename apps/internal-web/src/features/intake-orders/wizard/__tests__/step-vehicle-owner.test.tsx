import { m, setLocale } from '@mr/i18n'
import { IntakeOwnerType } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyIntakeWizardValues, type IntakeWizardValues } from '../intake-wizard-state.js'
import { StepVehicleOwner } from '../step-vehicle-owner.js'

/** The plate lookup runs on a query; it answers nothing here and the step must not need it to. */
function renderStep(values: IntakeWizardValues = emptyIntakeWizardValues(), onPatch = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    onPatch,
    ...render(
      <QueryClientProvider client={client}>
        <StepVehicleOwner values={values} onPatch={onPatch} />
      </QueryClientProvider>,
    ),
  }
}

describe('StepVehicleOwner — who the owner is', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    )
  })

  it('calls the number an ID card for a person and a tax number for a firm', () => {
    renderStep({ ...emptyIntakeWizardValues(), ownerType: IntakeOwnerType.Person })
    expect(screen.getByLabelText(new RegExp(m.intake_field_owner_id_card()))).toBeInTheDocument()

    renderStep({ ...emptyIntakeWizardValues(), ownerType: IntakeOwnerType.Company })
    expect(screen.getAllByLabelText(new RegExp(m.intake_field_owner_tax_id())).length).toBe(1)
  })

  it('clears the number when the type changes, so an ID card never becomes a tax number', async () => {
    // The lock that lets one column carry two different claims. Without it, a number typed as an ID
    // card a moment ago is silently relabelled on a document the customer signs (spec ⑤).
    const user = userEvent.setup()
    const { onPatch } = renderStep({
      ...emptyIntakeWizardValues(),
      ownerType: IntakeOwnerType.Person,
      ownerIdNumber: '008123456',
    })

    await user.click(screen.getByRole('button', { name: m.intake_owner_type_firma() }))

    expect(onPatch).toHaveBeenCalledWith({
      ownerType: IntakeOwnerType.Company,
      ownerIdNumber: '',
    })
  })

  it('keeps the number when the same type is pressed again', async () => {
    // Pressing the side already chosen is a mis-tap, not a change of mind — losing a typed number
    // to it would be the screen punishing a slip.
    const user = userEvent.setup()
    const { onPatch } = renderStep({
      ...emptyIntakeWizardValues(),
      ownerType: IntakeOwnerType.Person,
      ownerIdNumber: '008123456',
    })

    await user.click(screen.getByRole('button', { name: m.intake_owner_type_fizicko_lice() }))

    expect(onPatch).toHaveBeenCalledWith({ ownerType: IntakeOwnerType.Person })
  })
})
