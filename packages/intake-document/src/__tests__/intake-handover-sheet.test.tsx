import { IntakeDamageType } from '@mr/shared'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { intakeChecklistCatalogFixture, intakeOrderDetailFixture } from '../testing/index.js'
import { IntakeHandoverSheet } from '../intake-handover-sheet.js'

describe('the handover sheet', () => {
  it('prints every service and every material, however many there are', () => {
    // The whole purpose is that nothing is missing: an omission is the first thing a dissatisfied
    // owner reaches for (docs/25 §3.5). No "…and N more — see the order" line, ever.
    const services = Array.from({ length: 40 }, (_, i) => `Usluga ${i + 1}`)
    render(
      <IntakeHandoverSheet
        order={{ ...intakeOrderDetailFixture(), services, materials: [] }}
        checklistItems={intakeChecklistCatalogFixture()}
        locale="sr"
        logoSrc="/x.png"
      />,
    )

    expect(screen.getByText('Usluga 1')).toBeInTheDocument()
    expect(screen.getByText('Usluga 40')).toBeInTheDocument()
  })

  /**
   * The defects come from `order.*`, deliberately, and NOT from the print model — whose copies are
   * cut at `PRINT_MAX_DAMAGES` (12) and `PRINT_MAX_OTHER_DAMAGES` (3) for the one-page work order.
   * Nothing pinned that, so a tidy-up to `model.damages` would drop defect 13 off the paper whose
   * whole premise is that nothing is cut, and the suite would stay green.
   */
  it('prints every defect too, past the ceilings the one-page work order lives by', () => {
    const damages = Array.from({ length: 15 }, (_, i) => ({
      id: `d${i + 1}`,
      type: IntakeDamageType.Scratch,
      x: 10 + i,
      y: 20 + i,
      zone: `zona ${i + 1}`,
    }))
    const extraDamages = Array.from({ length: 5 }, (_, i) => `Dopisano ${i + 1}`)

    render(
      <IntakeHandoverSheet
        order={{ ...intakeOrderDetailFixture(), damages, extraDamages }}
        checklistItems={intakeChecklistCatalogFixture()}
        locale="sr"
        logoSrc="/x.png"
      />,
    )

    // 13 is past the marker ceiling, 5 past the written-in one — the two the model would have cut.
    expect(screen.getByText('zona 13')).toBeInTheDocument()
    expect(screen.getByText('zona 15')).toBeInTheDocument()
    expect(screen.getByText('Dopisano 4')).toBeInTheDocument()
    expect(screen.getByText('Dopisano 5')).toBeInTheDocument()
  })

  it('says so when no work was recorded, rather than printing an empty block', () => {
    render(
      <IntakeHandoverSheet
        order={{ ...intakeOrderDetailFixture(), services: [], materials: [] }}
        checklistItems={intakeChecklistCatalogFixture()}
        locale="sr"
        logoSrc="/x.png"
      />,
    )

    expect(screen.getByText(/nisu zabeleženi/i)).toBeInTheDocument()
  })
})
