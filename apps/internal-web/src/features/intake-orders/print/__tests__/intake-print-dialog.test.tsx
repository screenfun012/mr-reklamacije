import { getLocale, m } from '@mr/i18n'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  intakeOrderDetailFixture,
  intakePhotoFixture,
  renderDetailUi,
} from '../../detail/__tests__/render-detail.js'
import { IntakePrintDialog } from '../intake-print-dialog.js'

describe('IntakePrintDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('draws nothing while it is closed', async () => {
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open={false} onClose={() => {}} />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('prints on demand once it is open', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)

    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.intake_detail_print() }))

    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
  })

  it('is ready to print the moment it opens, and carries no photograph to wait for', async () => {
    // There used to be a gate here: `window.print()` does not wait for images and would print six
    // empty frames. The photographs left the document on 2026-08-10, so the gate went with them
    // rather than being left behind as something nobody could explain.
    //
    // The header emblem is the one image left, and it is a local asset the operator can see in the
    // preview before he presses print — the preview IS the gate now.
    const order = intakeOrderDetailFixture({
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444' })],
    })

    await renderDetailUi(<IntakePrintDialog order={order} open onClose={() => {}} />)

    expect(screen.getByRole('button', { name: m.intake_detail_print() })).toBeEnabled()
    const images = screen.getAllByRole('img', { hidden: true })
    expect(images).toHaveLength(1)
    expect(images[0]).toHaveAttribute('alt', 'MR Engines')
  })

  /**
   * The dialog is where the sheet's names come from, and it must read the DISPLAY catalog: `lanci` is
   * retired in the fixture, so the wizard's picker would not carry it and this preview would show a
   * bare code on the paper a customer signs (plan D3). Switch the factory and this goes red.
   */
  it('names a retired checklist item on the paper, not its bare code', async () => {
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    expect(screen.getByTestId('print-check-lanci')).toHaveTextContent('Lanci / alat')
  })

  it('prints the language the operator picked, not the one the app is in', async () => {
    // A foreign customer brings the car in. The office keeps working in Serbian; the paper he
    // signs must be English, and choosing that must not change the app around it.
    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={() => {}} />,
    )

    expect(screen.getByText(m.intake_print_title({}, { locale: 'sr' }))).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'en' }))

    expect(screen.getByText(m.intake_print_title({}, { locale: 'en' }))).toBeDefined()
    expect(screen.queryByText(m.intake_print_title({}, { locale: 'sr' }))).toBeNull()
    expect(getLocale()).toBe('sr')
  })

  it('closes on the close button and on Escape', async () => {
    const onClose = vi.fn()

    await renderDetailUi(
      <IntakePrintDialog order={intakeOrderDetailFixture()} open onClose={onClose} />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.action_close() }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
