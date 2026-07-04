import {
  engineManufacturersReferenceOptions,
  engineManufacturersReferenceQueryKey,
} from '@mr/shared'
import { setLocale } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { Suspense } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ClaimsFilters } from '../claims-filters.js'

const ACTIVE_MANUFACTURERS_LOOKUP = { activeOnly: true } as const

async function renderFilters(): Promise<void> {
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

  render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <ClaimsFilters search={{ page: 1, pageSize: 10 }} onSearchChange={() => undefined} />
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
})
