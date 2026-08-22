import {
  ClaimKind,
  claimCategoryFieldsForCategoryOptions,
  type ClaimCategoryFieldListItem,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CategoryFieldsCard } from '../category-fields-card.js'

const CATEGORY_ID = '22222222-2222-4222-8222-222222222222'
const CLAIM_ID = '33333333-3333-4333-8333-333333333333'

function option(code: string, name: string, sortOrder: number) {
  return {
    id: `o-${code}`,
    fieldId: 'f-part',
    fieldName: 'Sklop u kvaru',
    code,
    name,
    sortOrder,
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-08-22T00:00:00.000Z',
    usageCount: 0,
    parentOptionId: null,
    parentFieldCode: null,
    parentOptionCode: null,
  }
}

const PART_FIELD: ClaimCategoryFieldListItem = {
  id: 'f-part',
  categoryId: CATEGORY_ID,
  categoryName: 'Generalni remont motora',
  code: 'sklop_u_kvaru',
  name: 'Sklop u kvaru',
  fieldType: 'select',
  isRequired: false,
  sortOrder: 10,
  isActive: true,
  deactivatedAt: null,
  createdAt: '2026-08-22T00:00:00.000Z',
  usageCount: 0,
  options: [option('glava', 'Glava', 10), option('blok', 'Blok', 20)],
}

const TEXT_FIELD: ClaimCategoryFieldListItem = {
  ...PART_FIELD,
  id: 'f-km',
  code: 'predjeno_km',
  name: 'Pređeno km',
  fieldType: 'text',
  sortOrder: 30,
  options: [],
}

function renderCard(
  fields: ClaimCategoryFieldListItem[],
  values: Record<string, string>,
  withClaim = true,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(claimCategoryFieldsForCategoryOptions(CATEGORY_ID).queryKey, fields)

  render(
    <QueryClientProvider client={client}>
      <CategoryFieldsCard
        categoryId={CATEGORY_ID}
        categoryName="Generalni remont motora"
        values={values}
        {...(withClaim ? { claim: { id: CLAIM_ID, kind: ClaimKind.Emotive } } : {})}
      />
    </QueryClientProvider>,
  )
}

describe('the band that says nobody wrote down what failed', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ id: CLAIM_ID }), { status: 200 }))),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows while a picked question has no answer', () => {
    renderCard([PART_FIELD], {})
    expect(screen.getByTestId('category-fields-missing-band')).toBeInTheDocument()
  })

  it('is gone once it is answered', () => {
    renderCard([PART_FIELD], { sklop_u_kvaru: 'glava' })
    expect(screen.queryByTestId('category-fields-missing-band')).toBeNull()
  })

  it('never nags about a typed field — that one is often genuinely unknown', () => {
    renderCard([TEXT_FIELD], {})
    expect(screen.queryByTestId('category-fields-missing-band')).toBeNull()
  })

  it('is not offered to someone who may not edit the claim', () => {
    renderCard([PART_FIELD], {}, false)
    expect(screen.queryByTestId('category-fields-missing-band')).toBeNull()
  })

  it('saves ONLY the category answers, leaving the rest of the claim alone', async () => {
    renderCard([PART_FIELD], {})
    await userEvent.click(screen.getByRole('button', { name: 'Dopuni' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Glava' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/emotive-claims/${CLAIM_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ categoryFieldValues: { sklop_u_kvaru: 'glava' } }),
        }),
      )
    })
  })
})
