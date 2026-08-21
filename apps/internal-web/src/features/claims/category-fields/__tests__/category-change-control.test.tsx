import { setLocale } from '@mr/i18n'
import {
  ClaimKind,
  claimCategoriesReferenceOptions,
  claimCategoryFieldsForCategoryOptions,
  type ClaimCategoryListItem,
} from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CategoryChangeControl } from '../category-change-control.js'

const MACHINING_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OVERHAUL_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CLAIM_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const CATEGORIES: ClaimCategoryListItem[] = [
  {
    id: OVERHAUL_ID,
    code: 'REMONT_MOTORA',
    name: 'Generalni remont',
    sortOrder: 10,
    isActive: true,
    deactivatedAt: null,
    usageCount: 0,
  },
  {
    id: MACHINING_ID,
    code: 'MASINSKA_OBRADA',
    name: 'Mašinska obrada',
    sortOrder: 20,
    isActive: true,
    deactivatedAt: null,
    usageCount: 0,
  },
]

const REQUIRED_FIELD = {
  id: 'f1',
  categoryId: MACHINING_ID,
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
  options: [],
}

function renderControl({
  canEdit = true,
  machiningAsks = true,
}: { canEdit?: boolean; machiningAsks?: boolean } = {}): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, CATEGORIES)
  client.setQueryData(
    claimCategoryFieldsForCategoryOptions(MACHINING_ID).queryKey,
    machiningAsks ? [REQUIRED_FIELD] : [],
  )
  client.setQueryData(claimCategoryFieldsForCategoryOptions(OVERHAUL_ID).queryKey, [])

  render(
    <QueryClientProvider client={client}>
      <CategoryChangeControl
        kind={ClaimKind.Emotive}
        claimId={CLAIM_ID}
        category={{
          id: OVERHAUL_ID,
          code: 'REMONT_MOTORA',
          name: 'Generalni remont',
          isActive: true,
          deactivatedAt: null,
        }}
        canEdit={canEdit}
      />
    </QueryClientProvider>,
  )
}

function stubPatch(): ReturnType<typeof vi.fn> {
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ kind: 'emotive', id: CLAIM_ID, mrNumber: 'MR-1/26' }),
  })
  vi.stubGlobal('fetch', fetchSpy)
  return fetchSpy
}

describe('CategoryChangeControl', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('never changes the category on a single click — it asks, naming both', async () => {
    const user = userEvent.setup()
    const fetchSpy = stubPatch()
    renderControl()

    await user.click(screen.getByRole('button', { name: /Kategorija/ }))
    await user.click(await screen.findByRole('button', { name: 'Mašinska obrada' }))

    // Nothing saved yet: the claim's answers change meaning, so this is a decision, not a tap.
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(screen.getByText(/Generalni remont → Mašinska obrada/)).toBeInTheDocument()
  })

  it('warns up front when the new kind of work asks for something', async () => {
    const user = userEvent.setup()
    stubPatch()
    renderControl()

    await user.click(screen.getByRole('button', { name: /Kategorija/ }))
    await user.click(await screen.findByRole('button', { name: 'Mašinska obrada' }))

    expect(
      screen.getByText('Reklamacija će biti označena dok se nova polja ne popune.'),
    ).toBeInTheDocument()
  })

  it('stays quiet when the new kind of work asks for nothing', async () => {
    const user = userEvent.setup()
    stubPatch()
    renderControl({ machiningAsks: false })

    await user.click(screen.getByRole('button', { name: /Kategorija/ }))
    await user.click(await screen.findByRole('button', { name: 'Mašinska obrada' }))

    expect(
      screen.queryByText('Reklamacija će biti označena dok se nova polja ne popune.'),
    ).not.toBeInTheDocument()
  })

  it('sends the category alone, not the whole form', async () => {
    const user = userEvent.setup()
    const fetchSpy = stubPatch()
    renderControl()

    await user.click(screen.getByRole('button', { name: /Kategorija/ }))
    await user.click(await screen.findByRole('button', { name: 'Mašinska obrada' }))
    await user.click(screen.getByRole('button', { name: 'Promeni kategoriju' }))

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain(`/api/emotive-claims/${CLAIM_ID}`)
    expect(init.method).toBe('PATCH')
    // Correcting a category must not depend on every other field still being valid.
    expect(JSON.parse(String(init.body))).toEqual({ categoryId: MACHINING_ID })
  })

  it('shows the category as a plain chip to someone who may not edit the claim', () => {
    renderControl({ canEdit: false })

    expect(screen.queryByRole('button', { name: /Kategorija/ })).not.toBeInTheDocument()
    expect(screen.getByText('Generalni remont')).toBeInTheDocument()
  })

  it('keeps a switched-off category on the claim that carries it', () => {
    // The rule used to live in the basic-edit select. A category the office has retired must
    // still be NAMED on the claim — the menu simply offers no way back into it.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    client.setQueryData(claimCategoriesReferenceOptions({ activeOnly: true }).queryKey, CATEGORIES)

    render(
      <QueryClientProvider client={client}>
        <CategoryChangeControl
          kind={ClaimKind.Emotive}
          claimId={CLAIM_ID}
          category={{
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            code: 'KOMPRESORI',
            name: 'Ugašena kategorija',
            isActive: false,
            deactivatedAt: '2026-03-01T00:00:00.000Z',
          }}
          canEdit
        />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('button', { name: /Kategorija/ })).toHaveTextContent(
      'Ugašena kategorija',
    )
  })
})
