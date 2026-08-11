import { m } from '@mr/i18n'
import type { IntakeOrderDetail } from '@mr/shared'
import type { ReactElement } from 'react'

import { InternalNote } from '~/components/internal-note'

/**
 * "Not every photo has arrived yet" — the one thing this screen knows that the serviser needs in
 * the first minute after signing, while the customer is still beside the car.
 *
 * It is an `InternalNote`, not a third hand-written bar: the amber the draft bar spells out
 * literally is byte-for-byte this component's `warn` tone, and a third copy of those two colour
 * literals is the "copy-paste ×3" the house rules list under never-commit. The geometry override
 * is what seats it in the same row family as the two bars above it.
 *
 * There is nowhere to act on it yet, and the Fotografije tab is deliberately NOT that place: it is a
 * read grid with no upload queue of its own (H retired the office's ability to add a photo here at
 * all). A truthful warning still beats silence; inventing a retry button here does not.
 */
export function IntakePhotosPendingNote({ order }: { order: IntakeOrderDetail }): ReactElement {
  return (
    <InternalNote tone="warn" role="status" className="rounded-[12px] px-4 py-3.5">
      {m.intake_photos_pending_hint()} · {m.intake_photos_pending({ count: order.photosPending })}
    </InternalNote>
  )
}
