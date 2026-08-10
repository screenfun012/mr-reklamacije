import { getLocale, m } from '@mr/i18n'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  intakeOrderDetailFixture,
  intakePhotoFixture,
  renderDetailUi,
} from '../../detail/__tests__/render-detail.js'
import { IntakePrintDialog } from '../intake-print-dialog.js'

/** The sheet's thumbnails are decorative (`alt=""`), so they are hidden from the a11y tree. */
function thumbnails(): HTMLElement[] {
  return screen.getAllByRole('img', { hidden: true })
}

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

  it('will not print while a photograph is still loading', async () => {
    // `window.print()` does not wait for images. Fired early it prints empty frames — and the
    // customer signs a page whose evidence is missing.
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const order = intakeOrderDetailFixture({
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444' })],
    })

    await renderDetailUi(<IntakePrintDialog order={order} open onClose={() => {}} />)

    expect(screen.getByRole('button', { name: m.intake_detail_print() })).toBeDisabled()

    const [first] = thumbnails()
    fireEvent.load(first as HTMLElement)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: m.intake_detail_print() })).toBeEnabled(),
    )
  })

  it('lets a photograph that fails to load through, rather than locking the button forever', async () => {
    const order = intakeOrderDetailFixture({
      photos: [intakePhotoFixture({ id: '44444444-4444-4444-8444-444444444444' })],
    })

    await renderDetailUi(<IntakePrintDialog order={order} open onClose={() => {}} />)

    const [first] = thumbnails()
    fireEvent.error(first as HTMLElement)

    await waitFor(() =>
      expect(screen.getByRole('button', { name: m.intake_detail_print() })).toBeEnabled(),
    )
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
