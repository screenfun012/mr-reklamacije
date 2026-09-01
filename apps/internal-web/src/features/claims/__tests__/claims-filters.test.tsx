import {
  claimCategoryCountsOptions,
  engineManufacturersReferenceOptions,
  engineManufacturersReferenceQueryKey,
  engineTypesReferenceQueryKey,
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

const BMW_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MERCEDES_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const N47_ID = 'e1111111-1111-4111-8111-111111111111'
const OM651_ID = 'e2222222-2222-4222-8222-222222222222'

const ENGINE_TYPES = [
  {
    id: N47_ID,
    code: 'N47',
    manufacturerId: BMW_ID,
    manufacturerName: 'BMW',
    displacementCc: null,
    notes: null,
    isActive: true,
    usageCount: 3,
  },
  {
    id: OM651_ID,
    code: 'OM651',
    manufacturerId: MERCEDES_ID,
    manufacturerName: 'Mercedes-Benz',
    displacementCc: null,
    notes: null,
    isActive: true,
    usageCount: 1,
  },
] as const

async function renderFilters(
  mode: ClaimsListMode = { kind: 'all' },
  onLeaveCategory?: (next: ClaimsSearch) => void,
  overrides: {
    search?: Partial<ClaimsSearch>
    onSearchChange?: (next: ClaimsSearch) => void
  } = {},
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
      id: BMW_ID,
      code: 'BMW',
      name: 'BMW',
      sortOrder: 1,
      isActive: true,
    },
    {
      id: MERCEDES_ID,
      code: 'MB',
      name: 'Mercedes-Benz',
      sortOrder: 2,
      isActive: true,
    },
  ])

  queryClient.setQueryData(engineTypesReferenceQueryKey({ activeOnly: true }), ENGINE_TYPES)

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
          search={{ page: 1, pageSize: 10, ...overrides.search }}
          onSearchChange={overrides.onSearchChange ?? (() => undefined)}
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
    expect(within(kindGroup).getByRole('button', { name: 'Inostrane' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    expect(screen.getByRole('combobox', { name: 'Ishod' })).toHaveTextContent('Svi ishodi')
    expect(screen.getByRole('combobox', { name: 'Ishod' }).textContent).not.toContain(
      'Svi ishodi Svi ishodi',
    )
  })

  it('offers every active engine type while no manufacturer is picked', async () => {
    await renderFilters()

    await userEvent.click(screen.getByRole('combobox', { name: 'Tip motora' }))

    expect(await screen.findByRole('option', { name: 'N47' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'OM651' })).toBeInTheDocument()
  })

  it('narrows the engine types to the picked manufacturer', async () => {
    await renderFilters({ kind: 'all' }, undefined, { search: { manufacturerId: BMW_ID } })

    await userEvent.click(screen.getByRole('combobox', { name: 'Tip motora' }))

    expect(await screen.findByRole('option', { name: 'N47' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'OM651' })).not.toBeInTheDocument()
  })

  it('clears a type of another make when the manufacturer changes, and resets the page', async () => {
    const changes: ClaimsSearch[] = []
    await renderFilters({ kind: 'all' }, undefined, {
      search: { engineTypeId: OM651_ID, page: 3 },
      onSearchChange: (next) => changes.push(next),
    })

    await userEvent.click(screen.getByRole('combobox', { name: 'Proizvođač' }))
    await userEvent.click(await screen.findByRole('option', { name: 'BMW' }))

    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ manufacturerId: BMW_ID, page: 1 })
    expect(changes[0]?.engineTypeId).toBeUndefined()
  })

  it('keeps the chosen type when the manufacturer is cleared — the filters are independent', async () => {
    const changes: ClaimsSearch[] = []
    await renderFilters({ kind: 'all' }, undefined, {
      search: { manufacturerId: BMW_ID, engineTypeId: N47_ID },
      onSearchChange: (next) => changes.push(next),
    })

    await userEvent.click(screen.getByRole('combobox', { name: 'Proizvođač' }))
    await userEvent.click(await screen.findByRole('option', { name: 'Svi proizvođači' }))

    expect(changes).toHaveLength(1)
    expect(changes[0]?.manufacturerId).toBeUndefined()
    expect(changes[0]?.engineTypeId).toBe(N47_ID)
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
