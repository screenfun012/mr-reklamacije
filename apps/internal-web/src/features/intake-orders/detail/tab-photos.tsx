import { m } from '@mr/i18n'
import { type IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useState, type ReactElement } from 'react'

import { buildPhotoCells, type IntakePhotoCell } from '../wizard/intake-photo-grid'
import { IntakePhotoCellOverlay, photoCellBorderClass } from '../wizard/intake-photo-cell-state'
import { IntakePhotoLightbox } from '../wizard/intake-photo-lightbox'
import { CAPTION, CARD } from './detail-styles'

/** `IMG_03` — the photo's position in the list, padded, as the prototype names them (`:1443`). */
function photoName(index: number): string {
  return `IMG_${String(index + 1).padStart(2, '0')}`
}

/**
 * The whole photo documentation, four across (prototype 597–613) — a pure read since H (docs/25
 * §3.0): both adding and removing a photo after signing are retired, so this tab only shows what
 * was recorded and lets the office open any shot full-screen.
 *
 * No "not every photo arrived" bar either: that warning ships once, page-level under the header,
 * where all four tabs can see it (`intake-photos-pending-note.tsx`).
 */
export function TabPhotos({ order }: { order: IntakeOrderDetail }): ReactElement {
  const [preview, setPreview] = useState<IntakePhotoCell | null>(null)

  // No queue: the route no longer owns an upload queue (photos land only through the wizard now
  // that the office `+` cell is gone), so every cell here comes straight from the server.
  const cells = buildPhotoCells(order.id, order.photos, [], order.damages)

  return (
    // The lightbox is a sibling of the card, never a child of a `@container`: containment makes
    // the container the containing block for `position: fixed` (see `tab-overview.tsx`).
    <>
      <section className={cn(CARD, 'flex flex-col gap-[14px] px-[22px] py-5')}>
        {/* The count sits inside the red caption, undimmed — unlike the Pregled card's `· N`,
            which greys it (prototype :599 against :562). */}
        <h2 className={CAPTION}>
          {m.intake_card_photo_documentation()} · {cells.length}
        </h2>

        {cells.length === 0 ? (
          <p className="text-[13.5px] italic text-mri-text2">{m.intake_detail_no_photos()}</p>
        ) : (
          /* Four across a 363px phone gave 68px thumbnails with captions wider than the cell.
             Two there, four where the body is wide — the same 860 the rest of the detail uses. */
          <div className="@container/photos grid grid-cols-2 gap-[14px] @min-[860px]/photos:grid-cols-4">
            {cells.map((cell, index) => (
              <div key={cell.key} className="flex min-w-0 flex-col gap-[7px]">
                <button
                  type="button"
                  onClick={() => setPreview(cell)}
                  aria-label={m.intake_photo_preview()}
                  className={cn(
                    'relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-[10px] border bg-mri-inbg',
                    photoCellBorderClass(cell.state),
                  )}
                >
                  <img src={cell.url} alt="" className="size-full object-cover" />
                  {cell.number !== null && cell.numberColour !== null ? (
                    <span
                      className="absolute left-[6px] top-[6px] grid size-[22px] place-items-center rounded-full font-mono text-[11px] font-bold"
                      style={{ background: cell.numberColour.fill, color: cell.numberColour.text }}
                    >
                      {cell.number}
                    </span>
                  ) : null}
                  <IntakePhotoCellOverlay cell={cell} />
                </button>

                <span className="font-mono text-[10.5px] font-medium text-mri-text2">
                  {cell.number === null
                    ? photoName(index)
                    : m.intake_photo_caption_damage({
                        photo: photoName(index),
                        number: cell.number,
                      })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {preview === null ? null : (
        <IntakePhotoLightbox cell={preview} orderId={order.id} onClose={() => setPreview(null)} />
      )}
    </>
  )
}
