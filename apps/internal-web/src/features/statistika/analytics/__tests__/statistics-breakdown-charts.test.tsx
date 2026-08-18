import { setLocale } from '@mr/i18n'
import type { StatisticsByFaults } from '@mr/shared'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { StatisticsBreakdownCharts } from '../statistics-breakdown-charts'

const EMPLOYEE_ROW = { employeeId: null, code: 'X', name: 'Petar Petrović', total: 4 }
const PARTY_ROW = { id: 'a1', code: 'a1', name: 'Sklapanje', total: 2 }

const EMPTY_FAULTS: StatisticsByFaults = {
  byEmployee: [],
  byDepartment: [],
  byExternalParty: [],
}

/**
 * The reader without `employees.view_analytics` gets `null` for both per-person sections, and the
 * page has to keep working for him — a white screen would be a worse answer than the leak the gate
 * was built to close.
 */
describe('the statistics breakdown, for a reader who may not measure people', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('draws the rest of the page when the per-person sections are withheld', () => {
    render(
      <StatisticsBreakdownCharts
        byEmployee={null}
        byEngineType={{ items: [] }}
        byCustomer={{ items: [] }}
        byFaults={{ ...EMPTY_FAULTS, byEmployee: null, byDepartment: [PARTY_ROW] }}
      />,
    )

    // What is not about a named person is still there…
    expect(screen.getByText('Sklapanje')).toBeInTheDocument()
    // …and nothing claims the people section is empty, because that is not what happened.
    expect(screen.queryByText('Petar Petrović')).not.toBeInTheDocument()
  })

  it('shows the per-person figures to a reader who may see them', () => {
    render(
      <StatisticsBreakdownCharts
        byEmployee={{ items: [EMPLOYEE_ROW] }}
        byEngineType={{ items: [] }}
        byCustomer={{ items: [] }}
        byFaults={{ ...EMPTY_FAULTS, byEmployee: [PARTY_ROW] }}
      />,
    )

    expect(screen.getByText('Petar Petrović')).toBeInTheDocument()
  })
})
