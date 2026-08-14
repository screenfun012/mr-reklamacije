import { m } from '@mr/i18n'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CardDocument } from '../card-document'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail'

const sendDocument = vi.fn()
const produceDocument = vi.fn()

vi.mock('@mr/shared', async () => {
  const actual = await vi.importActual<typeof import('@mr/shared')>('@mr/shared')
  return {
    ...actual,
    sendIntakeOrderDocument: (id: string, kind: string) => sendDocument(id, kind),
    produceIntakeOrderDocument: (id: string, kind: string) => produceDocument(id, kind),
  }
})

describe('the document card on a signed order', () => {
  beforeEach(() => {
    sendDocument.mockReset()
    sendDocument.mockResolvedValue(undefined)
    produceDocument.mockReset()
    produceDocument.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('says nothing on a draft, which has no signed sheet to seal', async () => {
    await renderDetailUi(<CardDocument order={intakeDraftFixture()} canSend />)

    expect(screen.queryByText(m.intake_card_document())).toBeNull()
  })

  it('says the file is not there, and offers to make it', async () => {
    await renderDetailUi(
      <CardDocument order={intakeOrderDetailFixture({ documentReady: false })} canSend />,
    )

    expect(screen.getByText(m.intake_document_not_ready())).toBeDefined()
    expect(screen.queryByRole('link', { name: m.intake_document_download() })).toBeNull()
    // The sentence used to sit here alone and wait forever when the seal had failed.
    expect(screen.getByRole('button', { name: m.intake_document_produce() })).toBeDefined()
  })

  it('offers nobody the way back who may not send the paper anyway', async () => {
    await renderDetailUi(
      <CardDocument order={intakeOrderDetailFixture({ documentReady: false })} canSend={false} />,
    )

    expect(screen.getByText(m.intake_document_not_ready())).toBeDefined()
    expect(screen.queryByRole('button', { name: m.intake_document_produce() })).toBeNull()
  })

  it('makes the paper the pressed row is missing, not the other one', async () => {
    // The kind-routing failure this guards is the one that matters: producing under the wrong kind
    // mails the owner the wrong document as the record of the other act.
    await renderDetailUi(
      <CardDocument
        order={intakeOrderDetailFixture({
          documentReady: true,
          handoverSignedAt: '2026-08-15T10:00:00.000Z',
          handoverDocumentReady: false,
        })}
        canSend
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: m.intake_document_produce() }))

    await waitFor(() => expect(produceDocument).toHaveBeenCalledTimes(1))
    expect(produceDocument).toHaveBeenCalledWith(expect.any(String), 'handover')
  })

  it('offers the file, and says it has not reached the owner yet', async () => {
    await renderDetailUi(
      <CardDocument
        order={intakeOrderDetailFixture({ ownerEmail: 'vlasnik@example.com' })}
        canSend
      />,
    )

    expect(screen.getByText(m.intake_document_never_sent())).toBeDefined()
    expect(
      screen.getByRole('link', { name: m.intake_document_download() }).getAttribute('href'),
    ).toContain('/document')
  })

  it('sends the same file once the office confirms it', async () => {
    const order = intakeOrderDetailFixture({ ownerEmail: 'vlasnik@example.com' })
    await renderDetailUi(<CardDocument order={order} canSend />)

    await userEvent.click(screen.getByRole('button', { name: m.intake_document_send() }))
    // Confirmed because it leaves the building: an email cannot be recalled.
    expect(screen.getByText(m.intake_document_send_confirm_title())).toBeDefined()
    await userEvent.click(
      screen.getAllByRole('button', { name: m.intake_document_send() }).at(-1) as HTMLElement,
    )

    await waitFor(() => expect(sendDocument).toHaveBeenCalledWith(order.id, 'intake'))
  })

  it('does not offer to send to an owner who left no address', async () => {
    await renderDetailUi(
      <CardDocument order={intakeOrderDetailFixture({ ownerEmail: null })} canSend />,
    )

    expect(screen.getByText(m.intake_document_no_email())).toBeDefined()
    expect(screen.queryByRole('button', { name: m.intake_document_send() })).toBeNull()
    // The file is still there to download — the owner has his paper copy, the office has this.
    expect(screen.getByRole('link', { name: m.intake_document_download() })).toBeDefined()
  })

  it('hides the send button from anyone without the permission, and keeps the download', async () => {
    await renderDetailUi(
      <CardDocument
        order={intakeOrderDetailFixture({ ownerEmail: 'vlasnik@example.com' })}
        canSend={false}
      />,
    )

    expect(screen.queryByRole('button', { name: m.intake_document_send() })).toBeNull()
    expect(screen.getByRole('link', { name: m.intake_document_download() })).toBeDefined()
  })

  /*
   * The handover row appears only where a handover sheet exists. A vehicle released without
   * signatures never gets one, so a row saying "being prepared" would sit there forever — and the
   * two rows must reach two different files, which is the whole point of the `kind` on the wire.
   */
  it('shows nothing about a handover on an order that has not been handed over', async () => {
    await renderDetailUi(<CardDocument order={intakeOrderDetailFixture()} canSend />)

    expect(screen.queryByText(m.intake_document_kind_handover())).toBeNull()
  })

  it('offers the handover sheet as its own paper once both signed for it', async () => {
    const order = intakeOrderDetailFixture({
      ownerEmail: 'vlasnik@example.com',
      handoverSignedAt: '2026-08-15T10:00:00.000Z',
      handoverDocumentReady: true,
      handoverDocumentEmailedAt: null,
    })
    await renderDetailUi(<CardDocument order={order} canSend />)

    expect(screen.getByText(m.intake_document_kind_intake())).toBeDefined()
    expect(screen.getByText(m.intake_document_kind_handover())).toBeDefined()

    const hrefs = screen
      .getAllByRole('link', { name: m.intake_document_download() })
      .map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual([
      `/api/intake-orders/${order.id}/document?kind=intake`,
      `/api/intake-orders/${order.id}/document?kind=handover`,
    ])

    // And the send goes for the paper whose row was pressed, not for the first one on the card.
    await userEvent.click(
      screen.getAllByRole('button', { name: m.intake_document_send() }).at(-1) as HTMLElement,
    )
    await userEvent.click(
      screen.getAllByRole('button', { name: m.intake_document_send() }).at(-1) as HTMLElement,
    )

    await waitFor(() => expect(sendDocument).toHaveBeenCalledWith(order.id, 'handover'))
  })

  it('says when it was sent, and offers to send it again', async () => {
    await renderDetailUi(
      <CardDocument
        order={intakeOrderDetailFixture({
          ownerEmail: 'vlasnik@example.com',
          documentEmailedAt: '2026-08-14T08:22:00.000Z',
        })}
        canSend
      />,
    )

    expect(screen.getByRole('button', { name: m.intake_document_resend() })).toBeDefined()
    expect(screen.getByText(/14\.08\.2026/)).toBeDefined()
  })
})
