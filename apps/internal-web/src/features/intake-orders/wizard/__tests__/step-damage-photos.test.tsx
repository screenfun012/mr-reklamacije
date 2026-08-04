import { setLocale } from '@mr/i18n'
import { IntakeDamageType, IntakeVehicleType } from '@mr/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { emptyIntakeWizardValues, type IntakeWizardValues } from '../intake-wizard-state.js'
import { StepDamagePhotos } from '../step-damage-photos.js'
import type { IntakePhotoQueue, IntakePhotoQueueEntry } from '../use-intake-photo-queue.js'

function emptyQueue(entries: IntakePhotoQueueEntry[] = []): IntakePhotoQueue {
  return {
    entries,
    pending: 0,
    failed: 0,
    waiting: 0,
    outstanding: 0,
    online: true,
    enqueue: vi.fn(),
    retry: vi.fn(),
    discard: vi.fn(),
  }
}

function renderStep(values: IntakeWizardValues, onPatch = vi.fn(), queue = emptyQueue()) {
  const onDeletePhoto = vi.fn().mockResolvedValue(undefined)
  return {
    onDeletePhoto,
    queue,
    ...render(
      <StepDamagePhotos
        values={values}
        onPatch={onPatch}
        orderId="order-1"
        photos={[]}
        queue={queue}
        onSaveDamages={vi.fn().mockResolvedValue(undefined)}
        onDeletePhoto={onDeletePhoto}
      />,
    ),
  }
}

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

    renderStep(values, onPatch)

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
    renderStep(valuesWithDamages())

    expect(screen.getByText('Ogrebotina — zadnja vrata')).toBeInTheDocument()
    expect(screen.getByText('Udubljenje — leva bočna strana')).toBeInTheDocument()
    expect(screen.getByText('Rđa — prednji branik')).toBeInTheDocument()
  })

  it('offers the empty-state instruction instead of an empty card', () => {
    renderStep(emptyIntakeWizardValues())

    expect(screen.getByText('Nema unetih oštećenja — tapni na šemu levo.')).toBeInTheDocument()
  })
})

describe('StepDamagePhotos — the photo preview', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  function queueWithLandedEntry(): IntakePhotoQueue {
    return emptyQueue([
      {
        id: 'q1',
        damageId: null,
        state: 'ok',
        progress: 100,
        previewUrl: 'blob:local-1',
        attachmentId: 'att-1',
      },
    ])
  }

  /**
   * Deleting has to do BOTH halves: drop the file the server holds and drop the queue entry that
   * produced it. Doing only the first strands a landed upload in the queue forever, which is what
   * keeps the "not every photo arrived" indicator lit on an order that is complete.
   */
  it('deletes the photo and its queue entry, then closes', async () => {
    const user = userEvent.setup()
    const { onDeletePhoto, queue } = renderStep(
      emptyIntakeWizardValues(),
      vi.fn(),
      queueWithLandedEntry(),
    )

    await user.click(screen.getByRole('button', { name: 'Pregled fotografije' }))
    expect(screen.getByRole('dialog', { name: 'Pregled fotografije' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Obriši fotografiju' }))

    expect(onDeletePhoto).toHaveBeenCalledWith('att-1')
    expect(queue.discard).toHaveBeenCalledWith('q1')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes without deleting anything', async () => {
    const user = userEvent.setup()
    const { onDeletePhoto, queue } = renderStep(
      emptyIntakeWizardValues(),
      vi.fn(),
      queueWithLandedEntry(),
    )

    await user.click(screen.getByRole('button', { name: 'Pregled fotografije' }))
    await user.click(screen.getByRole('button', { name: 'Zatvori' }))

    expect(onDeletePhoto).not.toHaveBeenCalled()
    expect(queue.discard).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
