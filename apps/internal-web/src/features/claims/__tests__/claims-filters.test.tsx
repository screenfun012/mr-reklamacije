import {
  claimCategoryCountsOptions,
  engineManufacturersReferenceOptions,
  engineManufacturersReferenceQueryKey,
} from '@mr/shared'
import { setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ClaimsSearch } from '@mr/shared'

import { ClaimsFilters } from '../claims-filters.js'
import type { ClaimsListMode } from '../claims-list-mode.js'

const ACTIVE_MANUFACTURERS_LOOKUP = { activeOnly: true } as const

async function renderFilters(
  mode: ClaimsListMode = { kind: 'all' },
  onLeaveCategory?: (next: ClaimsSearch) => void,
): Promise<void> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  queryClient.setQueryData(engineManufacturersReferenceQueryKey(ACTIVE_MANUFACTURERS_LOOKUP), [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      code: 'BMW',
      name: 'BMW',
      sortOrder: 1,
      isActive: true,
    },
  ])

  queryClient.setQueryData(claimCategoryCountsOptions().queryKey, {
    items: [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        code: 'MASINSKA_OBRADA',
        name: 'Mašinska obrada',
        sortOrder: 20,
        isActive: true,
        total: 14,
        pending: 9,
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        code: 'KOMPRESORI',
        name: 'Kompresori',
        sortOrder: 90,
        isActive: false,
        total: 1,
        pending: 0,
      },
    ],
    totals: { total: 15, pending: 9 },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <ClaimsFilters
          search={{ page: 1, pageSize: 10 }}
          onSearchChange={() => undefined}
          mode={mode}
          onLeaveCategory={onLeaveCategory ?? (() => undefined)}
        />
      </Suspense>
    </QueryClientProvider>,
  )

  await screen.findByText('Proizvođač')
}

describe('ClaimsFilters', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  it('renders manufacturer filter without crashing when i18n keys are compiled', async () => {
    await renderFilters()

    expect(screen.getByText('Proizvođač')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Proizvođač' })).toBeInTheDocument()
    expect(engineManufacturersReferenceOptions(ACTIVE_MANUFACTURERS_LOOKUP).queryKey).toBeDefined()
  })

  it('renders kind segments and outcome filter with visible trigger labels', async () => {
    await renderFilters()

    // Kind is a segmented control now — "Sve" is the pressed segment by default.
    const kindGroup = screen.getByRole('group', { name: 'Vrsta' })
    const allSegment = within(kindGroup).getByRole('button', { name: 'Sve' })
    expect(allSegment).toHaveAttribute('aria-pressed', 'true')
    expect(within(kindGroup).getByRole('button', { name: 'EMOTIVE' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    expect(screen.getByRole('combobox', { name: 'Ishod' })).toHaveTextContent('Svi ishodi')
    expect(screen.getByRole('combobox', { name: 'Ishod' }).textContent).not.toContain(
      'Svi ishodi Svi ishodi',
    )
  })

  it('offers a retired category under its own heading, never mixed in with the live ones', async () => {
    await renderFilters()

    await userEvent.click(screen.getByRole('combobox', { name: 'Kategorija' }))

    expect(screen.getByText('Ugašene')).toBeInTheDocument()
    expect(screen.getByText('Kompresori †')).toBeInTheDocument()
  })

  it('inside a category shows a chip instead of the select, and leaving keeps the other filters', async () => {
    const left: ClaimsSearch[] = []
    await renderFilters(
      {
        kind: 'category',
        code: 'MASINSKA_OBRADA',
        category: {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          code: 'MASINSKA_OBRADA',
          name: 'Mašinska obrada',
          sortOrder: 20,
          isActive: true,
          total: 14,
          pending: 9,
        },
      },
      (next) => left.push(next),
    )

    // The category is the place here, so it has no control that could set it to something else.
    expect(screen.queryByRole('combobox', { name: 'Kategorija' })).not.toBeInTheDocument()
    expect(screen.getByTestId('claims-category-chip')).toHaveTextContent('Mašinska obrada')

    await userEvent.click(screen.getByRole('button', { name: 'Ukloni — pređi na sve reklamacije' }))
    expect(left).toHaveLength(1)
    expect(left[0]).toMatchObject({ page: 1, pageSize: 10 })
  })
})
