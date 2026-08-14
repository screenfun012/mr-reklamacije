import { m } from '@mr/i18n'
import { IntakeOrderStatus } from '@mr/shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INTAKE_WIZARD_STEP_COUNT } from '../../wizard/intake-wizard-state.js'
import { IntakeDetailHeader } from '../intake-detail-header.js'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

const NO_PERMS = {
  canAdvance: false,
  onPrint: () => {},
}

/**
 * The advance handler reads `updated.status` straight into the label map, so a stub answering with
 * anything other than a real status value throws inside the success path and the failure reads like
 * a bug in the component.
 */
function stubAdvanceOk(): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ orderNumber: 'RN-1', status: IntakeOrderStatus.PickedUp }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

describe('IntakeDetailHeader', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('offers no edit and no removal on a signed order', async () => {
    await renderDetailUi(
      <IntakeDetailHeader order={intakeOrderDetailFixture()} canAdvance onPrint={vi.fn()} />,
    )

    expect(
      screen.queryByRole('button', { name: 'Ispravi zatečeno stanje' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ukloni nalog' })).not.toBeInTheDocument()
  })

  it('offers the next status only with the advance permission, and never past Preuzeto', async () => {
    await renderDetailUi(<IntakeDetailHeader order={intakeOrderDetailFixture()} canAdvance />)

    // Primljeno → U radu.
    expect(
      screen.queryByRole('button', { name: m.intake_detail_advance({ status: 'U radu' }) }),
    ).not.toBeNull()
  })

  /*
   * These two pin the whole rule, and they assert WHICH request fired rather than which sentence
   * appeared.
   */
  it('sends the last step to the handover screen instead of moving the status from here', async () => {
    const fetchSpy = stubAdvanceOk()
    const order = intakeOrderDetailFixture({ status: IntakeOrderStatus.Done })

    await renderDetailUi(<IntakeDetailHeader order={order} canAdvance />)

    // Not a status nudge any more: `preuzeto` is two people signing at the car, and this rung has
    // to reach that screen rather than assert the fact on their behalf.
    expect(
      screen.queryByRole('button', { name: m.intake_detail_advance({ status: 'Preuzeto' }) }),
    ).toBeNull()
    const link = screen.getByRole('link', { name: m.intake_handover_open() })
    expect(link.getAttribute('href')).toBe(`/prijem/${order.id}/primopredaja`)

    fireEvent.click(link)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('lets the earlier steps through in one tap', async () => {
    const fetchSpy = stubAdvanceOk()

    await renderDetailUi(<IntakeDetailHeader order={intakeOrderDetailFixture()} canAdvance />)
    fireEvent.click(
      screen.getByRole('button', { name: m.intake_detail_advance({ status: 'U radu' }) }),
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
  })

  it('marks an unfinished intake as unfinished, not as Primljeno', async () => {
    // A draft is `primljeno` only because that is the column default. Printing it here put a blue
    // status pill directly above the amber "Nedovršen" bar, so one order said two things — and the
    // list already refuses to print it for exactly this reason.
    await renderDetailUi(
      <IntakeDetailHeader order={intakeDraftFixture({ draftStep: 3 })} {...NO_PERMS} />,
    )

    expect(screen.queryByText(m.intake_row_draft())).not.toBeNull()
    expect(screen.queryByText('Primljeno')).toBeNull()
    // The step belongs to the bar below, once. Seen in the browser: pill, tag and sentence said
    // "nedovršen" three times inside 100px, and the step twice.
    expect(
      screen.queryByText(m.intake_row_draft_step({ step: 3, total: INTAKE_WIZARD_STEP_COUNT })),
    ).toBeNull()
  })

  it('still names the status once the intake is signed', async () => {
    await renderDetailUi(<IntakeDetailHeader order={intakeOrderDetailFixture()} {...NO_PERMS} />)

    expect(screen.queryByText('Primljeno')).not.toBeNull()
  })
})

describe('IntakeDetailHeader — print', () => {
  it('asks for the print instead of standing there disabled', async () => {
    // The preview itself belongs to the PAGE, because the page is also what the wizard's `?stampa`
    // flag lands on — two owners of one dialog would race each other open.
    const onPrint = vi.fn()

    await renderDetailUi(
      <IntakeDetailHeader order={intakeOrderDetailFixture()} {...NO_PERMS} onPrint={onPrint} />,
    )

    const button = screen.getByRole('button', { name: m.intake_detail_print() })
    expect(button).toBeEnabled()

    fireEvent.click(button)

    expect(onPrint).toHaveBeenCalledTimes(1)
  })

  it('offers no print on an unfinished intake — there is nothing signed to hand over', async () => {
    await renderDetailUi(<IntakeDetailHeader order={intakeDraftFixture()} {...NO_PERMS} />)

    expect(screen.queryByRole('button', { name: m.intake_detail_print() })).toBeNull()
  })
})
