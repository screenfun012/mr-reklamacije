import { m } from '@mr/i18n'
import type { IntakeOrderDetail } from '@mr/shared'
import { cn } from '@mr/ui'
import { useState, type ReactElement } from 'react'

import { buildPhotoCells, type IntakePhotoCell } from '../wizard/intake-photo-grid'
import { IntakePhotoLightbox } from '../wizard/intake-photo-lightbox'
import { CAPTION, CARD } from './detail-styles'

/** `IMG_03` — the photo's position in the list, padded, as the prototype names them (`:1443`). */
function photoName(index: number): string {
  return `IMG_${String(index + 1).padStart(2, '0')}`
}

/**
 * The whole photo documentation, four across (prototype 597–613). Read-only on purpose: adding or
 * re-sending a photo needs the wizard's upload queue, so `IntakePhotoGrid` — which carries the
 * camera inputs and the `+` cell — is deliberately NOT reused here (V-6-2 owns that).
 *
 * No "not every photo arrived" bar either: that warning ships once, page-level under the header,
 * where all four tabs can see it (`intake-photos-pending-note.tsx`).
 */
export function TabPhotos({ order }: { order: IntakeOrderDetail }): ReactElement {
  const [preview, setPreview] = useState<IntakePhotoCell | null>(null)

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
          <div className="grid grid-cols-4 gap-[14px]">
            {cells.map((cell, index) => (
              <div key={cell.key} className="flex min-w-0 flex-col gap-[7px]">
                <button
                  type="button"
                  onClick={() => setPreview(cell)}
                  aria-label={m.intake_photo_preview()}
                  className="relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-[10px] border border-mri-border2 bg-mri-inbg"
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
