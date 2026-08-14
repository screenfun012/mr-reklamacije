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
