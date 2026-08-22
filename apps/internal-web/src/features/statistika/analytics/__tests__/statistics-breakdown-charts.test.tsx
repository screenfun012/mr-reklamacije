import { setLocale } from '@mr/i18n'
import {
  STATISTICS_FIELD_PREDATES_CODE,
  STATISTICS_FIELD_UNFILLED_CODE,
  type StatisticsByFaults,
  type StatisticsCategoryFieldGroup,
} from '@mr/shared'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StatisticsBreakdownCharts } from '../statistics-breakdown-charts'

/**
 * jsdom measures every box as 0×0, so a `ResponsiveContainer` left to itself draws no bars at all
 * and there is nothing to click. Sizing it is the only way to test what a bar click does.
 */
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <actual.ResponsiveContainer width={600} height={300}>
        {children as React.ReactElement}
      </actual.ResponsiveContainer>
    ),
  }
})

const EMPLOYEE_ROW = { employeeId: null, code: 'X', name: 'Petar Petrović', total: 4 }
const PARTY_ROW = { id: 'a1', code: 'a1', name: 'Sklapanje', total: 2 }

const EMPTY_FAULTS: StatisticsByFaults = {
  byEmployee: [],
  byDepartment: [],
  byExternalParty: [],
}

const ASSEMBLY_FIELD = {
  fieldCode: 'sklop_u_kvaru',
  fieldName: 'Sklop u kvaru',
  isActive: true,
  items: [
    { code: 'glava', name: 'Glava', total: 7, isActive: true },
    { code: 'karburator', name: 'Karburator', total: 2, isActive: false },
    { code: STATISTICS_FIELD_UNFILLED_CODE, name: '', total: 3, isActive: true },
    { code: STATISTICS_FIELD_PREDATES_CODE, name: '', total: 1, isActive: true },
  ],
}

const OVERHAUL_GROUP: StatisticsCategoryFieldGroup = {
  categoryCode: 'REMONT_MOTORA',
  categoryName: 'Generalni remont motora',
  total: 13,
  fields: [
    ASSEMBLY_FIELD,
    {
      fieldCode: 'pojava_kvara',
      fieldName: 'Kako se kvar ispoljio',
      isActive: true,
      items: [{ code: 'gubi_ulje', name: 'Gubi ulje', total: 3, isActive: true }],
    },
  ],
}

function renderBreakdown(
  overrides: Partial<React.ComponentProps<typeof StatisticsBreakdownCharts>> = {},
): { container: HTMLElement } {
  const { container } = render(
    <StatisticsBreakdownCharts
      byEmployee={null}
      byEngineType={{ items: [] }}
      byCategory={{ items: [] }}
      byCustomer={{ items: [] }}
      byFaults={{ ...EMPTY_FAULTS, byEmployee: null }}
      byCategoryFields={[]}
      onAnswerSelect={() => undefined}
      {...overrides}
    />,
  )

  return { container }
}

/** The bars of the single chart on screen, in the order the card draws them. */
function bars(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('.recharts-bar-rectangle'))
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
    renderBreakdown({
      byFaults: { ...EMPTY_FAULTS, byEmployee: null, byDepartment: [PARTY_ROW] },
    })

    // What is not about a named person is still there…
    expect(screen.getAllByText('Sklapanje').length).toBeGreaterThan(0)
    // …and nothing claims the people section is empty, because that is not what happened.
    expect(screen.queryByText('Petar Petrović')).not.toBeInTheDocument()
  })

  it('shows the per-person figures to a reader who may see them', () => {
    renderBreakdown({
      byEmployee: { items: [EMPLOYEE_ROW] },
      byFaults: { ...EMPTY_FAULTS, byEmployee: [PARTY_ROW] },
    })

    expect(screen.getAllByText('Petar Petrović').length).toBeGreaterThan(0)
  })
})

describe('the category-field section', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('draws one card per field, under its category', () => {
    renderBreakdown({ byCategoryFields: [OVERHAUL_GROUP] })

    expect(screen.getByText('Generalni remont motora')).toBeInTheDocument()
    expect(screen.getByText('Sklop u kvaru')).toBeInTheDocument()
    expect(screen.getByText('Kako se kvar ispoljio')).toBeInTheDocument()
  })

  it('draws nothing for a category whose fields nobody defined', () => {
    renderBreakdown({
      byCategoryFields: [
        { categoryCode: 'AUTO_SERVIS', categoryName: 'Auto servis', total: 4, fields: [] },
      ],
    })

    expect(screen.queryByText('Auto servis')).not.toBeInTheDocument()
  })

  it('labels the two synthetic buckets in Serbian, and marks a retired option with †', () => {
    renderBreakdown({
      byCategoryFields: [{ ...OVERHAUL_GROUP, fields: [ASSEMBLY_FIELD] }],
    })

    expect(screen.getAllByText('Nije upisano').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Uvedeno posle unosa').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Karburator †').length).toBeGreaterThan(0)
  })

  it('a bar click sets categoryCode, fieldCode and optionCode together', async () => {
    const onAnswerSelect = vi.fn()
    const { container } = renderBreakdown({
      byCategoryFields: [{ ...OVERHAUL_GROUP, fields: [ASSEMBLY_FIELD] }],
      onAnswerSelect,
    })

    await userEvent.click(bars(container)[0] as Element)

    expect(onAnswerSelect).toHaveBeenCalledWith({
      categoryCode: 'REMONT_MOTORA',
      fieldCode: 'sklop_u_kvaru',
      optionCode: 'glava',
    })
  })

  it('does not filter by a bucket that is not an answer', async () => {
    const onAnswerSelect = vi.fn()
    const { container } = renderBreakdown({
      byCategoryFields: [{ ...OVERHAUL_GROUP, fields: [ASSEMBLY_FIELD] }],
      onAnswerSelect,
    })

    // Bars 3 and 4 are "Nije upisano" and "Uvedeno posle unosa" — neither is an answer a claim carries.
    await userEvent.click(bars(container)[2] as Element)
    await userEvent.click(bars(container)[3] as Element)

    expect(onAnswerSelect).not.toHaveBeenCalled()
  })
})
