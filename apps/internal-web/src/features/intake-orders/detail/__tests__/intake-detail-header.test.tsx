import { m } from '@mr/i18n'
import { IntakeOrderStatus } from '@mr/shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { IntakeDetailHeader } from '../intake-detail-header.js'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

const NO_PERMS = { canAdvance: false, canDelete: false, canChangeStatus: false }

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

  it('shows the amended pill only on an amended order', async () => {
    await renderDetailUi(<IntakeDetailHeader order={intakeOrderDetailFixture()} {...NO_PERMS} />)
    expect(screen.queryByText(m.intake_detail_amended_badge())).toBeNull()
  })

  it('shows the amended pill once the condition was corrected after signing', async () => {
    const order = intakeOrderDetailFixture({
      amendedAt: '2026-07-28T10:00:00.000Z',
      amendedByName: 'Jelena Petrović',
    })

    await renderDetailUi(<IntakeDetailHeader order={order} {...NO_PERMS} />)
    expect(screen.queryByText(m.intake_detail_amended_badge())).not.toBeNull()
  })

  it('offers the next status only with the advance permission, and never past Preuzeto', async () => {
    await renderDetailUi(
      <IntakeDetailHeader
        order={intakeOrderDetailFixture()}
        canAdvance
        canDelete={false}
        canChangeStatus={false}
      />,
    )

    // Primljeno → U radu.
    expect(
      screen.queryByRole('button', { name: m.intake_detail_advance({ status: 'U radu' }) }),
    ).not.toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_detail_remove() })).toBeNull()
  })

  it('draws no action but print on a removed order, whatever the caller may do', async () => {
    const order = intakeOrderDetailFixture({ deletedAt: '2026-07-29T08:00:00.000Z' })

    await renderDetailUi(
      <IntakeDetailHeader order={order} canAdvance canDelete canChangeStatus={false} />,
    )

    expect(screen.queryByRole('button', { name: m.intake_detail_remove() })).toBeNull()
    expect(
      screen.queryByRole('button', { name: m.intake_detail_advance({ status: 'U radu' }) }),
    ).toBeNull()
  })

  /*
   * These three pin the whole rule, and they assert WHICH request fired rather than which sentence
   * appeared: a dialog that renders but does not hold the request back protects nothing.
   */
  it('holds the last step behind a confirmation for someone who cannot move it back', async () => {
    const fetchSpy = stubAdvanceOk()
    const order = intakeOrderDetailFixture({ status: IntakeOrderStatus.Done })

    await renderDetailUi(
      <IntakeDetailHeader order={order} canAdvance canDelete={false} canChangeStatus={false} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: m.intake_detail_advance({ status: 'Preuzeto' }) }),
    )

    expect(
      screen.queryByText(m.intake_detail_pickup_title({ number: order.orderNumber })),
    ).not.toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: m.intake_detail_pickup_confirm() }))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(`/api/intake-orders/${order.id}/advance`)

    // And it closes. ConfirmDialog never closes itself, so a caller that forgets leaves a live
    // confirm button over a finished job — the second press gets the server's 409 and the serviser
    // is told his successful action failed.
    await waitFor(() =>
      expect(
        screen.queryByText(m.intake_detail_pickup_title({ number: order.orderNumber })),
      ).toBeNull(),
    )
  })

  it('lets the earlier steps through in one tap', async () => {
    const fetchSpy = stubAdvanceOk()

    await renderDetailUi(
      <IntakeDetailHeader
        order={intakeOrderDetailFixture()}
        canAdvance
        canDelete={false}
        canChangeStatus={false}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: m.intake_detail_advance({ status: 'U radu' }) }),
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
  })

  it('does not stop someone who has the status strip below and can move it back', async () => {
    const fetchSpy = stubAdvanceOk()
    const order = intakeOrderDetailFixture({ status: IntakeOrderStatus.Done })

    await renderDetailUi(
      <IntakeDetailHeader order={order} canAdvance canDelete={false} canChangeStatus />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: m.intake_detail_advance({ status: 'Preuzeto' }) }),
    )

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(
      screen.queryByText(m.intake_detail_pickup_title({ number: order.orderNumber })),
    ).toBeNull()
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
    expect(screen.queryByText(m.intake_row_draft_step({ step: 3 }))).toBeNull()
  })

  it('still names the status once the intake is signed', async () => {
    await renderDetailUi(<IntakeDetailHeader order={intakeOrderDetailFixture()} {...NO_PERMS} />)

    expect(screen.queryByText('Primljeno')).not.toBeNull()
  })
})
