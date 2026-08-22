import { setLocale } from '@mr/i18n'
import {
  claimCategoriesReferenceQueryKey,
  engineManufacturersReferenceQueryKey,
  type StatisticsCategoryFieldGroup,
  type StatisticsSearch,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StatisticsAnalyticsFilters } from '../statistics-analytics-filters'

const ACTIVE_LOOKUP = { activeOnly: true } as const

const CATEGORY_FIELDS: StatisticsCategoryFieldGroup[] = [
  {
    categoryCode: 'REMONT_MOTORA',
    categoryName: 'Generalni remont motora',
    total: 7,
    fields: [
      {
        fieldCode: 'sklop_u_kvaru',
        fieldName: 'Sklop u kvaru',
        isActive: true,
        items: [{ code: 'glava', name: 'Glava', total: 7, isActive: true }],
      },
    ],
  },
]

/** A screen already narrowed to one answer — every assertion here is about keeping or dropping it. */
const ANSWER_SEARCH: StatisticsSearch = {
  kind: 'emotive',
  categoryCode: 'REMONT_MOTORA',
  fieldCode: 'sklop_u_kvaru',
  optionCode: 'glava',
}

async function renderFilters(
  search: StatisticsSearch,
  onSearchChange: (next: StatisticsSearch) => void,
): Promise<void> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  queryClient.setQueryData(engineManufacturersReferenceQueryKey(ACTIVE_LOOKUP), [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      code: 'MAN',
      name: 'MAN',
      sortOrder: 1,
      isActive: true,
    },
  ])
  queryClient.setQueryData(claimCategoriesReferenceQueryKey(ACTIVE_LOOKUP), [
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      code: 'REMONT_MOTORA',
      name: 'Generalni remont motora',
      sortOrder: 10,
      isActive: true,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      code: 'MASINSKA_OBRADA',
      name: 'Mašinska obrada',
      sortOrder: 20,
      isActive: true,
    },
  ])

  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <StatisticsAnalyticsFilters
          search={search}
          onSearchChange={onSearchChange}
          byCategoryFields={CATEGORY_FIELDS}
        />
      </Suspense>
    </QueryClientProvider>,
  )

  await screen.findByText('Period')
}

describe('the statistics filters, once one answer holds the whole screen', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('names the active answer', async () => {
    await renderFilters(ANSWER_SEARCH, () => undefined)

    expect(screen.getByTestId('statistics-answer-chip')).toHaveTextContent('Sklop u kvaru')
    expect(screen.getByTestId('statistics-answer-chip')).toHaveTextContent('Glava')
  })

  it('the answer filter survives a period change', async () => {
    const changes: StatisticsSearch[] = []
    await renderFilters(ANSWER_SEARCH, (next) => changes.push(next))

    const year = String(new Date().getUTCFullYear())
    await userEvent.click(screen.getByRole('combobox', { name: 'Period' }))
    await userEvent.click(screen.getByRole('option', { name: year }))

    expect(changes).toHaveLength(1)
    expect(changes[0]).toEqual({
      kind: 'emotive',
      manufacturerId: undefined,
      categoryCode: 'REMONT_MOTORA',
      fieldCode: 'sklop_u_kvaru',
      optionCode: 'glava',
      year: Number.parseInt(year, 10),
    })
  })

  it('the chip clears all three at once', async () => {
    const changes: StatisticsSearch[] = []
    await renderFilters(ANSWER_SEARCH, (next) => changes.push(next))

    await userEvent.click(screen.getByRole('button', { name: 'Ukloni filter' }))

    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: 'emotive' })
    expect(changes[0]?.categoryCode).toBeUndefined()
    expect(changes[0]?.fieldCode).toBeUndefined()
    expect(changes[0]?.optionCode).toBeUndefined()
  })

  it('drops the answer when the category under it changes', async () => {
    const changes: StatisticsSearch[] = []
    await renderFilters(ANSWER_SEARCH, (next) => changes.push(next))

    await userEvent.click(screen.getByRole('combobox', { name: 'Kategorija' }))
    await userEvent.click(screen.getByText('Mašinska obrada'))

    // A field code belongs to ONE category — carried over, it would name a question the new
    // category does not ask, and the screen would go empty with a chip still on it.
    expect(changes).toHaveLength(1)
    expect(changes[0]?.categoryCode).toBe('MASINSKA_OBRADA')
    expect(changes[0]?.fieldCode).toBeUndefined()
    expect(changes[0]?.optionCode).toBeUndefined()
  })

  it('draws no chip when no answer is chosen', async () => {
    await renderFilters({ categoryCode: 'REMONT_MOTORA' }, vi.fn())

    expect(screen.queryByTestId('statistics-answer-chip')).not.toBeInTheDocument()
  })
})
