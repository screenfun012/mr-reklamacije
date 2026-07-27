import { setLocale } from '@mr/i18n'
import { IntakeDamageType, IntakeVehicleType } from '@mr/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyIntakeWizardValues, type IntakeWizardValues } from '../intake-wizard-state.js'
import { StepDamagePhotos } from '../step-damage-photos.js'

function valuesWithDamages(): IntakeWizardValues {
  return {
    ...emptyIntakeWizardValues(),
    vehicleType: IntakeVehicleType.Van,
    damages: [
      { id: 'd1', type: IntakeDamageType.Scratch, x: 100, y: 60, zone: 'zadnja vrata' },
      { id: 'd2', type: IntakeDamageType.Dent, x: 40, y: 300, zone: 'leva bočna strana' },
      { id: 'd3', type: IntakeDamageType.Rust, x: 170, y: 530, zone: 'prednji branik' },
    ],
  }
}

describe('StepDamagePhotos — removing a damage', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  /**
   * `ConfirmDialog` does not close itself — the caller owns `open`. Forgetting that leaves the
   * dialog on screen after the delete, and because the list has already renumbered by then it
   * re-reads the gone damage's index and asks "Obrisati oštećenje 0?".
   */
  it('names the damage by the number the serviser can see, and closes once it is gone', async () => {
    const user = userEvent.setup()
    const onPatch = vi.fn()
    const values = valuesWithDamages()

    render(<StepDamagePhotos values={values} onPatch={onPatch} />)

    const removeButtons = screen.getAllByRole('button', { name: 'Obriši oštećenje' })
    await user.click(removeButtons[1] as HTMLElement)

    expect(screen.getByText('Obrisati oštećenje 2?')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Obriši oštećenje' }))

    expect(onPatch).toHaveBeenCalledWith({
      damages: [values.damages[0], values.damages[2]],
    })
    expect(screen.queryByText(/Obrisati oštećenje/)).not.toBeInTheDocument()
  })

  it('lists every damage in the order that is its numbering', () => {
    render(<StepDamagePhotos values={valuesWithDamages()} onPatch={vi.fn()} />)

    expect(screen.getByText('Ogrebotina — zadnja vrata')).toBeInTheDocument()
    expect(screen.getByText('Udubljenje — leva bočna strana')).toBeInTheDocument()
    expect(screen.getByText('Rđa — prednji branik')).toBeInTheDocument()
  })

  it('offers the empty-state instruction instead of an empty card', () => {
    render(<StepDamagePhotos values={emptyIntakeWizardValues()} onPatch={vi.fn()} />)

    expect(screen.getByText('Nema unetih oštećenja — tapni na šemu levo.')).toBeInTheDocument()
  })
})
