import { m } from '@mr/i18n'
import type { ReactElement } from 'react'

import type { IntakePrintModel } from './intake-print-data'
import { PRINT_BAND } from './intake-print-styles'

/**
 * Six thumbnails, each carrying the number of the defect it documents. That badge is what ties a
 * photograph to a line in the list; without it the photos are six pictures of a car.
 */
export function IntakePrintPhotos({ model }: { model: IntakePrintModel }): ReactElement {
  const { locale } = model

  return (
    <section>
      <div className={PRINT_BAND}>
        {m.intake_print_section_photos({ count: model.photoCount }, { locale })}
      </div>

      <div className="mt-[9px] grid grid-cols-6 gap-2">
        {model.photos.map((photo) => (
          <span
            key={photo.id}
            className="relative block aspect-[4/3] overflow-hidden border border-[#c9cacd]"
          >
            <img src={photo.url} alt="" className="size-full object-cover" />
            {photo.number === null ? null : (
              <span
                data-testid="print-photo-badge"
                className="absolute left-[2px] top-[2px] grid size-[15px] place-items-center rounded-full bg-[#ed1c24] font-mono text-[8.5px] font-bold text-white"
              >
                {photo.number}
              </span>
            )}
          </span>
        ))}
      </div>

      {model.photoOverflowText === null ? null : (
        <p className="mt-[5px] text-[9.5px] text-[#54555b]">{model.photoOverflowText}</p>
      )}
    </section>
  )
}
