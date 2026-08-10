import { m } from '@mr/i18n'
import { IntakeDamageType } from '@mr/shared'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TabPhotos } from '../tab-photos.js'
import {
  emptyQueueStub,
  intakeDraftFixture,
  intakeOrderDetailFixture,
  queueEntryStub,
  renderDetailUi,
} from './render-detail.js'

const DAMAGES = [
  { id: 'd1', type: IntakeDamageType.Scratch, x: 100, y: 100, zone: 'Prednji branik' },
  { id: 'd2', type: IntakeDamageType.Dent, x: 200, y: 140, zone: 'Zadnja leva vrata' },
]

function photo(id: string, damageId: string | null) {
  return {
    id,
    fileName: `${id}.jpg`,
    mimeType: 'image/jpeg',
    fileSizeBytes: 12_345,
    width: 2048,
    height: 1536,
    thumbnailPath: null,
    caption: null,
    damageId,
    uploadedAt: '2026-07-27T19:00:00.000Z',
  }
}

const TWO_PHOTOS = [
  photo('44444444-4444-4444-8444-444444444444', null),
  photo('55555555-5555-4555-8555-555555555555', 'd2'),
]

const READ_ONLY = { canAddPhotos: false, isOrderTechnician: false }

describe('TabPhotos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('numbers each shot by its position and names the damage it belongs to', async () => {
    const order = intakeOrderDetailFixture({ damages: DAMAGES, photos: TWO_PHOTOS })

    await renderDetailUi(<TabPhotos order={order} queue={emptyQueueStub()} {...READ_ONLY} />)

    expect(screen.getByRole('heading')).toHaveTextContent(
      `${m.intake_card_photo_documentation()} · 2`,
    )
    // Position in the list, padded — not the phone's own filename.
    expect(screen.getByText('IMG_01')).toBeDefined()
    // Second damage in the array, so ② on the map and ② in the caption.
    expect(
      screen.getByText(m.intake_photo_caption_damage({ photo: 'IMG_02', number: 2 })),
    ).toBeDefined()
  })

  it('says there are none rather than drawing an empty grid, on a draft too', async () => {
    // A draft reaches this tab — `DRAFT_TABS` includes it — and has usually taken nothing yet.
    await renderDetailUi(
      <TabPhotos order={intakeDraftFixture()} queue={emptyQueueStub()} {...READ_ONLY} />,
    )

    expect(screen.getByText(m.intake_detail_no_photos())).toBeDefined()
  })

  it('offers no camera without both amend and update, whatever the route would answer', async () => {
    // A role built in admin with `amend` but no `update` would otherwise get a "+" whose every
    // tap is a 403 from the route.
    const order = intakeOrderDetailFixture({ damages: DAMAGES, photos: TWO_PHOTOS })

    await renderDetailUi(<TabPhotos order={order} queue={emptyQueueStub()} {...READ_ONLY} />)

    expect(screen.queryByRole('button', { name: m.intake_photo_add() })).toBeNull()
  })

  it('opens the full photo on a tap', async () => {
    const order = intakeOrderDetailFixture({ damages: DAMAGES, photos: TWO_PHOTOS })

    await renderDetailUi(<TabPhotos order={order} queue={emptyQueueStub()} {...READ_ONLY} />)
    expect(screen.queryByRole('dialog')).toBeNull()

    const [first] = screen.getAllByRole('button', { name: m.intake_photo_preview() })
    await userEvent.click(first as HTMLElement)

    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('warns about the permanent mark when the office adds a photo', async () => {
    const order = intakeOrderDetailFixture()

    await renderDetailUi(
      <TabPhotos order={order} queue={emptyQueueStub()} canAddPhotos isOrderTechnician={false} />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.intake_photo_add() }))

    expect(screen.getByRole('dialog')).toHaveTextContent(m.intake_photo_add_stamp_warning())
  })

  it("does not warn when the order's own serviser adds one, because the server stamps nothing", async () => {
    // A late arrival from the order's own technician is part of the intake, not an amendment
    // (`intake-orders.service.ts` uploadPhoto). Promising a permanent mark that never happens is
    // the dialog lying to the one person who reads it.
    const order = intakeOrderDetailFixture()

    await renderDetailUi(
      <TabPhotos order={order} queue={emptyQueueStub()} canAddPhotos isOrderTechnician />,
    )

    fireEvent.click(screen.getByRole('button', { name: m.intake_photo_add() }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).not.toHaveTextContent(m.intake_photo_add_stamp_warning())
    expect(dialog).toHaveTextContent(m.intake_photo_add_description())
  })

  it('shows a cell that is still on its way, so a failed office upload is visible here', async () => {
    const order = intakeOrderDetailFixture()
    const queue = emptyQueueStub({ entries: [queueEntryStub({ id: 'q1', state: 'err' })] })

    await renderDetailUi(
      <TabPhotos order={order} queue={queue} canAddPhotos isOrderTechnician={false} />,
    )

    expect(screen.getByText(`! ${m.intake_photo_state_failed()}`)).toBeDefined()
  })

  it('discards the queue entry alongside the server row, so a deleted photo does not come back', async () => {
    // The queue does not clear landed entries — the grid only hides them once the server lists the
    // photo. Deleting without `discard` puts the photo straight back as an upload in flight.
    const discard = vi.fn()
    const landed = photo('66666666-6666-4666-8666-666666666666', null)
    const order = intakeOrderDetailFixture({ photos: [landed] })
    const queue = emptyQueueStub({
      discard,
      entries: [queueEntryStub({ id: 'q1', attachmentId: landed.id })],
    })
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchSpy)

    await renderDetailUi(
      <TabPhotos order={order} queue={queue} canAddPhotos isOrderTechnician={false} />,
    )

    await userEvent.click(screen.getByRole('button', { name: m.intake_photo_preview() }))
    fireEvent.click(screen.getByRole('button', { name: m.intake_photo_delete() }))
    fireEvent.click(screen.getByRole('button', { name: m.intake_photo_delete_confirm() }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain(`/photos/${landed.id}`)
    await waitFor(() => expect(discard).toHaveBeenCalledWith('q1'))
  })
})
