import { m } from '@mr/i18n'
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { IntakePhotosPendingNote } from '../intake-photos-pending-note.js'
import { intakeOrderDetailFixture, renderDetailUi } from './render-detail.js'

describe('IntakePhotosPendingNote', () => {
  /*
   * The COUNT, not the sentence. The fixed half of the note renders identically whether the number
   * behind it is 3, 0 or undefined — asserting it would pass while the only piece of information
   * the note carries was broken.
   */
  it('says how many photos are still missing', async () => {
    await renderDetailUi(
      <IntakePhotosPendingNote order={intakeOrderDetailFixture({ photosPending: 3 })} />,
    )

    expect(
      screen.queryByText(m.intake_photos_pending({ count: 3 }), { exact: false }),
    ).not.toBeNull()
    expect(screen.queryByText(m.intake_photos_pending_hint(), { exact: false })).not.toBeNull()
  })
})
