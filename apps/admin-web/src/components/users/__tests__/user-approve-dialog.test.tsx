import { setLocale } from '@mr/i18n'
import type { UserListItem } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { UserApproveDialog } from '../user-approve-dialog'

const EXISTING_FIRM = { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Postojeća firma' }
const CREATED_FIRM = { id: 'bbbbbbbb-0000-4000-8000-000000000002', name: 'Nova firma doo' }

function makeUser(id: string, requestedCompany: string | null): UserListItem {
  return {
    id,
    email: `${id}@mrengines.rs`,
    name: `User ${id}`,
    isActive: true,
    accountStatus: 'pending',
    requestedCompany,
    roles: [],
    createdAt: '2026-07-22T10:00:00.000Z',
  } as unknown as UserListItem
}

/** Resolves the POST /api/customers response only when the test says so. */
function deferredCreate(): { respond: () => void } {
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()

      if (init?.method === 'POST' && url.includes('/api/customers')) {
        await gate
        return new Response(JSON.stringify({ ...CREATED_FIRM, isActive: true, usageCount: 0 }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // The firm dropdown's reference list.
      return new Response(
        JSON.stringify({ items: [{ ...EXISTING_FIRM, isActive: true, usageCount: 0 }], total: 1 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }),
  )

  return {
    respond: () => release?.(),
  }
}

function renderDialog(user: UserListItem | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onConfirm = vi.fn()

  const view = render(
    <QueryClientProvider client={queryClient}>
      <UserApproveDialog
        user={user}
        open={user !== null}
        pending={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />
    </QueryClientProvider>,
  )

  const rerenderWith = (next: UserListItem | null): void => {
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <UserApproveDialog
          user={next}
          open={next !== null}
          pending={false}
          onOpenChange={vi.fn()}
          onConfirm={onConfirm}
        />
      </QueryClientProvider>,
    )
  }

  return { onConfirm, rerenderWith }
}

describe('UserApproveDialog — inline new firm', () => {
  beforeEach(() => {
    setLocale('sr')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('prefills the new-firm name with what the applicant typed', async () => {
    deferredCreate()
    renderDialog(makeUser('11111111-1111-4111-8111-111111111111', 'Auto servis Petrović'))

    await userEvent.click(await screen.findByRole('button', { name: '+ Nova firma' }))

    expect(await screen.findByDisplayValue('Auto servis Petrović')).toBeInTheDocument()
  })

  it('does not apply a create that finished after the dialog moved to another user', async () => {
    // The dialog instance is reused for every approval, so a slow create must not
    // land on whoever is being approved next — that silently links one client to
    // another client's firm, and nothing on screen says so.
    const gate = deferredCreate()
    const userA = makeUser('11111111-1111-4111-8111-111111111111', 'Firma A')
    const userB = makeUser('22222222-2222-4222-8222-222222222222', 'Firma B')

    const { onConfirm, rerenderWith } = renderDialog(userA)

    await userEvent.click(await screen.findByRole('button', { name: '+ Nova firma' }))
    await userEvent.click(screen.getByRole('button', { name: 'Napravi i izaberi' }))

    // The approval moves on while the POST is still in flight.
    rerenderWith(userB)
    gate.respond()

    // Give the resolved mutation every chance to write into the new target.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Odobri' })).toBeDisabled())

    await userEvent.click(screen.getByRole('button', { name: 'Odobri' }))
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
