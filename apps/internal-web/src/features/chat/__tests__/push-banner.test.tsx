import { m, setLocale } from '@mr/i18n'
import { PushSubscriptionMode, pushKeys } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PushBanner } from '~/features/chat/push-banner'

const ORIGINAL_NAVIGATOR = globalThis.navigator

function install(options: {
  publicKey?: string | null
  subscribed?: boolean
  push?: boolean
}): void {
  const { publicKey = 'kljuc', subscribed = false, push = true } = options
  const devices = subscribed
    ? [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'iPad',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
        },
      ]
    : []

  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/public-key')) {
      return Response.json({ publicKey })
    }
    return Response.json({ items: devices, total: devices.length, page: 1, pageSize: 10 })
  }) as unknown as typeof fetch

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      ...ORIGINAL_NAVIGATOR,
      serviceWorker: { ready: Promise.resolve({}) },
      userAgent: 'Chrome',
    },
  })

  const scope = globalThis as unknown as Record<string, unknown>
  if (push) {
    scope['PushManager'] = class {}
    scope['Notification'] = class {}
  } else {
    delete scope['PushManager']
    delete scope['Notification']
  }
}

function renderBanner(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PushBanner />
    </QueryClientProvider>,
  )
  return queryClient
}

/** Waiting for the ANSWER before asserting its absence — a negative assertion made too early
 * proves nothing, which mutation testing showed on the switch beside this. */
async function settled(queryClient: QueryClient): Promise<void> {
  await waitFor(() => {
    expect(queryClient.getQueryData(pushKeys.devices())).toBeDefined()
  })
}

describe('the bar that asks once', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
    localStorage.clear()
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: ORIGINAL_NAVIGATOR,
    })
  })

  it('offers the one press to somebody who has not turned them on', async () => {
    install({})
    renderBanner()

    expect(await screen.findByText(m.chat_push_banner_title())).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.chat_push_enable() })).toBeInTheDocument()
  })

  it('stays out of the way once they are on', async () => {
    install({ subscribed: true })
    const queryClient = renderBanner()
    await settled(queryClient)

    expect(screen.queryByText(m.chat_push_banner_title())).not.toBeInTheDocument()
  })

  it('says nothing when the server is not set up for push', async () => {
    install({ publicKey: null })
    const queryClient = renderBanner()
    await settled(queryClient)

    // Our own configuration, not anything the person could act on.
    expect(screen.queryByText(m.chat_push_banner_title())).not.toBeInTheDocument()
  })

  it('offers no button where there is nothing to press', async () => {
    install({ push: false })
    const queryClient = renderBanner()
    await settled(queryClient)

    // The panel says WHY in that case; a bar with a dead button would not.
    expect(screen.queryByText(m.chat_push_banner_title())).not.toBeInTheDocument()
  })

  it('can be put away, and stays away', async () => {
    const user = userEvent.setup()
    install({})
    renderBanner()

    await user.click(await screen.findByRole('button', { name: m.chat_push_banner_dismiss() }))

    await waitFor(() => {
      expect(screen.queryByText(m.chat_push_banner_title())).not.toBeInTheDocument()
    })
    // ⚠ Per browser, like DND beside it: putting it away on the office computer must not silence
    // the offer on the phone, which is the device the whole feature is for.
    expect(localStorage.getItem('mrr:internal:chat:push-banner-dismissed')).toBe('1')
  })
})
