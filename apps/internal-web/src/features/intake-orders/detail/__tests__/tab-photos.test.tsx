import { m } from '@mr/i18n'
import { IntakeDamageType } from '@mr/shared'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { TabPhotos } from '../tab-photos.js'
import { intakeDraftFixture, intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

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

describe('TabPhotos', () => {
  it('numbers each shot by its position and names the damage it belongs to', async () => {
    const order = intakeOrderDetailFixture({ damages: DAMAGES, photos: TWO_PHOTOS })

    await renderDetailUi(<TabPhotos order={order} />)

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
    await renderDetailUi(<TabPhotos order={intakeDraftFixture()} />)

    expect(screen.getByText(m.intake_detail_no_photos())).toBeDefined()
  })

  /*
   * This tab is a read. Re-sending a failed photo needs the wizard's upload queue (V-6-2), so
   * reusing `IntakePhotoGrid` here would offer a camera whose files nothing carries — the
   * serviser would tap it, watch nothing happen, and believe the photo is on the server.
   */
  it('offers no way to add a photo', async () => {
    const order = intakeOrderDetailFixture({ damages: DAMAGES, photos: TWO_PHOTOS })

    await renderDetailUi(<TabPhotos order={order} />)

    expect(screen.queryByRole('button', { name: m.intake_photo_open_camera() })).toBeNull()
    expect(screen.queryByRole('button', { name: m.intake_photo_from_gallery() })).toBeNull()
  })

  it('opens the full photo on a tap', async () => {
    const order = intakeOrderDetailFixture({ damages: DAMAGES, photos: TWO_PHOTOS })

    await renderDetailUi(<TabPhotos order={order} />)
    expect(screen.queryByRole('dialog')).toBeNull()

    const [first] = screen.getAllByRole('button', { name: m.intake_photo_preview() })
    await userEvent.click(first as HTMLElement)

    expect(screen.getByRole('dialog')).toBeDefined()
  })
})
