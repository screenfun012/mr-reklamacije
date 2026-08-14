import { m } from '@mr/i18n'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CardDocument } from '../card-document'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail'

const sendDocument = vi.fn()

vi.mock('@mr/shared', async () => {
  const actual = await vi.importActual<typeof import('@mr/shared')>('@mr/shared')
  return { ...actual, sendIntakeOrderDocument: (id: string) => sendDocument(id) }
})

describe('the document card on a signed order', () => {
  beforeEach(() => {
    sendDocument.mockReset()
    sendDocument.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('says nothing on a draft, which has no signed sheet to seal', async () => {
    await renderDetailUi(<CardDocument order={intakeDraftFixture()} canSend />)

    expect(screen.queryByText(m.intake_card_document())).toBeNull()
  })

  it('says the file is still being made rather than offering a dead button', async () => {
    await renderDetailUi(
      <CardDocument order={intakeOrderDetailFixture({ documentReady: false })} canSend />,
    )

    expect(screen.getByText(m.intake_document_not_ready())).toBeDefined()
    expect(screen.queryByRole('link', { name: m.intake_document_download() })).toBeNull()
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

    await waitFor(() => expect(sendDocument).toHaveBeenCalledWith(order.id))
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
