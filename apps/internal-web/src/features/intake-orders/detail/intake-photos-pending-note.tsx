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
 * A removed order is deliberately excluded even when photos are outstanding: the server refuses
 * every upload to it, so the note would ask for something that cannot be done — and `photosExpected`
 * is never cleared on removal, so it would say it forever. This is the same liveness the status bar
 * already applies one row below.
 *
 * There is nowhere to act on it yet — the Fotografije tab that would carry a retry is task 11. A
 * truthful warning still beats silence; inventing a retry button here does not.
 */
export function IntakePhotosPendingNote({ order }: { order: IntakeOrderDetail }): ReactElement {
  return (
    <InternalNote tone="warn" role="status" className="rounded-[12px] px-4 py-3.5">
      {m.intake_photos_pending_hint()} · {m.intake_photos_pending({ count: order.photosPending })}
    </InternalNote>
  )
}
