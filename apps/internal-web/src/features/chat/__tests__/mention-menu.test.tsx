import { setLocale, m } from '@mr/i18n'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Composer } from '../composer'

const CONVERSATION_ID = '11111111-1111-4111-8111-111111111111'
const ANA_ID = 'a1a1a1a1-1111-4111-8111-aaaaaaaaaaaa'
const MARKO_ID = 'b2b2b2b2-2222-4222-8222-bbbbbbbbbbbb'
const DJORDJE_ID = 'c3c3c3c3-3333-4333-8333-cccccccccccc'

const PEOPLE = [
  { id: ANA_ID, name: 'Ana Anić', initials: 'AA' },
  { id: MARKO_ID, name: 'Marko Marković', initials: 'MM' },
  { id: DJORDJE_ID, name: 'Đorđe Ilić', initials: 'ĐI' },
]

function installFetch(): void {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/people')) {
      return Response.json({ items: PEOPLE })
    }
    return Response.json({ items: [], unreadTotal: 0 })
  }) as unknown as typeof fetch
}

function renderComposer(onSend = vi.fn()): { onSend: ReturnType<typeof vi.fn> } {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <Composer
        isThread={false}
        onSend={onSend}
        conversationId={CONVERSATION_ID}
        onOpened={vi.fn()}
      />
    </QueryClientProvider>,
  )
  return { onSend }
}

function field(): HTMLTextAreaElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement
}

describe('typing @ offers the people who can read the room', () => {
  beforeEach(() => {
    setLocale('sr')
    installFetch()
  })

  it('opens on @ and narrows as you type', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.type(field(), 'zdravo @')
    expect(await screen.findByRole('option', { name: /Marko/ })).toBeInTheDocument()

    await user.type(field(), 'an')
    expect(screen.queryByRole('option', { name: /Marko/ })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Ana/ })).toBeInTheDocument()
  })

  it('finds a Serbian name typed without its diacritics', async () => {
    // Nobody types Đ on a hurried keyboard. `normalizeName` folds đ/dj and č/ć/š/ž the same way
    // the employee roster matches names, so the picker behaves like the rest of the app.
    const user = userEvent.setup()
    renderComposer()

    await user.type(field(), '@djor')

    expect(await screen.findByRole('option', { name: /Đorđe/ })).toBeInTheDocument()
  })

  it('offers svi first, always', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.type(field(), '@')

    const options = await screen.findAllByRole('option')
    expect(options[0]).toHaveTextContent(m.chat_mention_everyone())
  })

  it('writes the id, not the name that was typed', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.type(field(), 'zdravo @an')
    await screen.findByRole('option', { name: /Ana/ })
    await user.keyboard('{Enter}')

    expect(field().value).toBe(`zdravo @[Ana Anić](${ANA_ID}) `)
  })

  it('arrows move the choice and Enter takes it', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.type(field(), '@')
    await screen.findAllByRole('option')
    await user.keyboard('{ArrowDown}{Enter}')

    // svi is first, so one step down is the first person.
    expect(field().value).toBe(`@[Ana Anić](${ANA_ID}) `)
  })

  it('Enter sends the message when the menu is shut', async () => {
    const user = userEvent.setup()
    const { onSend } = renderComposer()

    await user.type(field(), 'obicna poruka')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledWith('obicna poruka')
  })

  it('Enter chooses instead of sending while the menu is open', async () => {
    const user = userEvent.setup()
    const { onSend } = renderComposer()

    await user.type(field(), 'zdravo @an')
    await screen.findByRole('option', { name: /Ana/ })
    await user.keyboard('{Enter}')

    // Otherwise picking somebody posts an unfinished sentence to the whole shop.
    expect(onSend).not.toHaveBeenCalled()
  })

  it('Escape shuts the menu and leaves the words alone', async () => {
    const user = userEvent.setup()
    renderComposer()

    await user.type(field(), 'zdravo @an')
    await screen.findByRole('option', { name: /Ana/ })
    await user.keyboard('{Escape}')

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
    expect(field().value).toBe('zdravo @an')
  })

  it('says nothing about an e-mail address', async () => {
    const user = userEvent.setup()
    renderComposer()

    // `@` only opens a menu at the start of a word — otherwise every address typed in the shop
    // would drop a list of colleagues over the field.
    // ⚠ The local part after @ must MATCH somebody, or this passes because nobody answered to
    // "firma" rather than because @ refused to open mid-word — which is what it did at first.
    await user.type(field(), 'posalji na mail@ana')

    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
})
