import { setLocale } from '@mr/i18n'
import { claimCategoryFieldsForCategoryOptions, type ClaimCategoryFieldValues } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CategoryFieldsGroup } from '../category-fields-group.js'

const CATEGORY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function option(code: string, name: string, sortOrder: number, isActive = true) {
  return {
    id: `o-${code}`,
    fieldId: 'f1',
    fieldName: 'Obrađeni deo',
    code,
    name,
    sortOrder,
    isActive,
    deactivatedAt: null,
    createdAt: '2026-08-21T00:00:00.000Z',
    usageCount: 0,
    parentOptionId: null,
    parentFieldCode: null,
    parentOptionCode: null,
  }
}

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
    options: [option('glava', 'Glava', 10), option('blok', 'Blok', 20)],
  },
  {
    id: 'f2',
    categoryId: CATEGORY_ID,
    categoryName: 'Mašinska obrada',
    code: 'mera_obrade',
    name: 'Mera obrade (mm)',
    fieldType: 'text' as const,
    isRequired: false,
    sortOrder: 20,
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-08-21T00:00:00.000Z',
    usageCount: 0,
    options: [],
  },
]

function renderGroup(
  values: ClaimCategoryFieldValues,
  onChange: (next: ClaimCategoryFieldValues) => void,
  fields: typeof FIELDS | [] = FIELDS,
): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  queryClient.setQueryData(claimCategoryFieldsForCategoryOptions(CATEGORY_ID).queryKey, fields)

  render(
    <QueryClientProvider client={queryClient}>
      <CategoryFieldsGroup
        categoryId={CATEGORY_ID}
        categoryName="Mašinska obrada"
        values={values}
        onChange={onChange}
      />
    </QueryClientProvider>,
  )
}

describe('CategoryFieldsGroup', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('asks only what this kind of work asks, and marks what is required', async () => {
    renderGroup({}, vi.fn())

    await waitFor(() => expect(screen.getByTestId('category-fields-group')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Glava' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Mera obrade (mm)' })).toBeInTheDocument()
    expect(screen.getByText(/Obrađeni deo/)).toHaveTextContent('*')
  })

  it('renders nothing at all for a category that asks nothing', () => {
    // Not an empty dashed box — that reads as something being broken.
    renderGroup({}, vi.fn(), [])

    expect(screen.queryByTestId('category-fields-group')).not.toBeInTheDocument()
  })

  it('reports a picked answer, and clears it when the same button is pressed again', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    renderGroup({}, onChange)

    await waitFor(() => expect(screen.getByTestId('category-fields-group')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Glava' }))
    expect(onChange).toHaveBeenCalledWith({ obradjeni_deo: 'glava' })

    onChange.mockClear()
    renderGroup({ obradjeni_deo: 'glava' }, onChange)
    const chosen = screen.getAllByRole('button', { name: 'Glava' }).at(-1)
    await user.click(chosen as HTMLElement)
    expect(onChange).toHaveBeenCalledWith({})
  })

  it('shows a retired field the claim answered, and refuses to let it be changed', async () => {
    // The office stopped asking; the answer already given must still be readable, and frozen.
    renderGroup({ obradjeni_deo: 'glava' }, vi.fn(), [
      { ...FIELDS[0]!, isActive: false },
      FIELDS[1]!,
    ])

    await waitFor(() => expect(screen.getByTestId('category-fields-group')).toBeInTheDocument())
    expect(screen.getByText('ukinuto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Glava' })).toBeDisabled()
  })
})
