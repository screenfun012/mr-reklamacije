import { setLocale } from '@mr/i18n'
import { claimCategoryFieldsForCategoryOptions } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { CategoryFieldsCard } from '../category-fields-card.js'

const CATEGORY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const FIELDS = [
  {
    id: 'f1',
    categoryId: CATEGORY_ID,
    categoryName: 'Mašinska obrada',
    code: 'obradjeni_deo',
    name: 'Obrađeni deo',
    fieldType: 'select' as const,
    isRequired: true,
    sortOrder: 10,
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-08-21T00:00:00.000Z',
    usageCount: 0,
    options: [
      {
        id: 'o1',
        fieldId: 'f1',
        fieldName: 'Obrađeni deo',
        code: 'glava',
        name: 'Glava',
        sortOrder: 10,
        isActive: true,
        deactivatedAt: null,
        createdAt: '2026-08-21T00:00:00.000Z',
        usageCount: 0,
      },
    ],
  },
]

function renderCard(props: Partial<React.ComponentProps<typeof CategoryFieldsCard>> = {}): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(claimCategoryFieldsForCategoryOptions(CATEGORY_ID).queryKey, FIELDS)

  render(
    <QueryClientProvider client={queryClient}>
      <CategoryFieldsCard
        categoryId={CATEGORY_ID}
        categoryName="Mašinska obrada"
        values={{}}
        previous={[]}
        missing={[]}
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('CategoryFieldsCard', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('names the answer in words, not in codes', async () => {
    renderCard({ values: { obradjeni_deo: 'glava' } })

    await waitFor(() => expect(screen.getByTestId('category-fields-card')).toBeInTheDocument())
    expect(screen.getByText('Glava')).toBeInTheDocument()
    expect(screen.queryByText('glava')).not.toBeInTheDocument()
  })

  it('says "not filled in" rather than leaving a blank', async () => {
    renderCard()

    await waitFor(() => expect(screen.getByTestId('category-fields-card')).toBeInTheDocument())
    expect(screen.getByText('Nije popunjeno')).toBeInTheDocument()
  })

  it('marks the card amber while a required field has no answer', async () => {
    renderCard({ missing: ['obradjeni_deo'] })

    await waitFor(() => expect(screen.getByTestId('category-fields-card')).toBeInTheDocument())
    // The mark is the whole point of the handoff: a moved claim must not look finished.
    expect(screen.getByText(/DOPUNI PODATKE/i)).toBeInTheDocument()
    expect(screen.getByTestId('category-fields-card').className).toContain('border-dashed')
  })

  it('keeps what was answered under a kind of work the claim was moved away from', async () => {
    const user = userEvent.setup()
    renderCard({
      previous: [
        {
          categoryCode: 'REMONT_MOTORA',
          categoryName: 'Generalni remont',
          values: [{ fieldCode: 'obim', fieldName: 'Obim remonta', display: 'Veliki' }],
        },
      ],
    })

    await waitFor(() => expect(screen.getByTestId('category-fields-card')).toBeInTheDocument())
    // Collapsed by default — it is history, not what the claim is about now.
    expect(screen.queryByText('Veliki')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Prethodna kategorija/ }))
    expect(screen.getByText('Generalni remont')).toBeInTheDocument()
    expect(screen.getByText('Veliki')).toBeInTheDocument()
  })

  it('renders nothing when there is neither a question nor a history', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(claimCategoryFieldsForCategoryOptions(CATEGORY_ID).queryKey, [])

    render(
      <QueryClientProvider client={queryClient}>
        <CategoryFieldsCard
          categoryId={CATEGORY_ID}
          categoryName="Auto-servis"
          values={{}}
          previous={[]}
          missing={[]}
        />
      </QueryClientProvider>,
    )

    expect(screen.queryByTestId('category-fields-card')).not.toBeInTheDocument()
  })
})
