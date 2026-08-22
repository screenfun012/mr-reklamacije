import { claimCategoryFieldsForCategoryOptions, type ClaimCategoryFieldListItem } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CategoryFieldsGroup } from '../category-fields-group.js'

const CATEGORY_ID = '11111111-1111-4111-8111-111111111111'

function option(
  code: string,
  name: string,
  sortOrder: number,
  parent: { fieldCode: string; optionCode: string } | null = null,
) {
  return {
    id: `o-${code}`,
    fieldId: 'f',
    fieldName: 'x',
    code,
    name,
    sortOrder,
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-08-22T00:00:00.000Z',
    usageCount: 0,
    parentOptionId: parent === null ? null : `o-${parent.optionCode}`,
    parentFieldCode: parent?.fieldCode ?? null,
    parentOptionCode: parent?.optionCode ?? null,
  }
}

const FIELDS: ClaimCategoryFieldListItem[] = [
  {
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
  },
  {
    id: 'f-cause',
    categoryId: CATEGORY_ID,
    categoryName: 'Generalni remont motora',
    code: 'uzrok_kvara',
    name: 'Uzrok kvara',
    fieldType: 'select',
    isRequired: false,
    sortOrder: 15,
    isActive: true,
    deactivatedAt: null,
    createdAt: '2026-08-22T00:00:00.000Z',
    usageCount: 0,
    options: [
      option('glava_ventili', 'Ventili ne zaptivaju', 10, {
        fieldCode: 'sklop_u_kvaru',
        optionCode: 'glava',
      }),
      option('blok_pukao', 'Pukao', 20, { fieldCode: 'sklop_u_kvaru', optionCode: 'blok' }),
    ],
  },
]

function renderGroup(values: Record<string, string>, onChange = vi.fn()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(claimCategoryFieldsForCategoryOptions(CATEGORY_ID).queryKey, FIELDS)

  render(
    <QueryClientProvider client={client}>
      <CategoryFieldsGroup
        categoryId={CATEGORY_ID}
        categoryName="Generalni remont motora"
        values={values}
        onChange={onChange}
      />
    </QueryClientProvider>,
  )
  return onChange
}

describe('CategoryFieldsGroup — a field that hangs off another', () => {
  it('says which answer it is waiting for instead of showing an empty control', () => {
    renderGroup({})
    expect(screen.getByText('Prvo izaberi: Sklop u kvaru')).toBeInTheDocument()
  })

  it('offers only the causes of the chosen assembly', () => {
    renderGroup({ sklop_u_kvaru: 'glava' })
    expect(screen.getByRole('button', { name: 'Ventili ne zaptivaju' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pukao' })).toBeNull()
  })

  it('drops the cause when the assembly is changed under it', async () => {
    const onChange = renderGroup({ sklop_u_kvaru: 'glava', uzrok_kvara: 'glava_ventili' })
    await userEvent.click(screen.getByRole('button', { name: 'Blok' }))
    // Without this the form would keep a pair the server refuses, and the person would read a
    // 400 about a field they never touched.
    expect(onChange).toHaveBeenCalledWith({ sklop_u_kvaru: 'blok' })
  })
})
