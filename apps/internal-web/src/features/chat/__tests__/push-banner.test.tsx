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
  ios?: boolean
}): void {
  const { publicKey = 'AQID', subscribed = false, push = true, ios = false } = options
  const devices = subscribed
    ? [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'iPad',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
          isCurrent: true,
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
      serviceWorker: {
        register: vi.fn().mockResolvedValue(undefined),
        ready: Promise.resolve({
          pushManager: {
            getSubscription: async () =>
              subscribed
                ? {
                    endpoint: 'https://fcm.googleapis.com/fcm/send/ovaj-pregledac',
                    options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer },
                    toJSON: () => ({ keys: { p256dh: 'kljuc', auth: 'tajna' } }),
                  }
                : null,
          },
        }),
      },
      userAgent: ios ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' : 'Chrome',
    },
  })

  const scope = globalThis as unknown as Record<string, unknown>
  if (push) {
    scope['PushManager'] = class {}
    scope['Notification'] = class {
      static permission = subscribed ? 'granted' : 'default'
      static requestPermission = vi.fn().mockResolvedValue(subscribed ? 'granted' : 'default')
    }
  } else {
    delete scope['PushManager']
    delete scope['Notification']
  }
}

function renderBanner(): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <PushBanner userId="11111111-1111-4111-8111-111111111111" />
    </QueryClientProvider>,
  )
  return queryClient
}

/** Waiting for the ANSWER before asserting its absence — a negative assertion made too early
 * proves nothing, which mutation testing showed on the switch beside this. */
async function settled(queryClient: QueryClient): Promise<void> {
  await waitFor(() => {
    expect(queryClient.getQueryData(pushKeys.publicKey())).toBeDefined()
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
    const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
    expect(
      calls.some(
        (call) =>
          String(call[0]).endsWith('/api/push/devices') &&
          (call[1] as RequestInit | undefined)?.method !== 'POST',
      ),
    ).toBe(false)
  })

  it('stays out of the way once they are on', async () => {
    install({ subscribed: true })
    const queryClient = renderBanner()
    /*
     * ⚠ Waits for THIS BROWSER's answer, not the device list. The bar is hidden while the answer is
     * still coming, so waiting on the list alone would let this pass before anything was decided —
     * the same trap the switch beside it documents. Since 2026-08-25 the list is not the question:
     * a second device with another one already in it must still be offered the button.
     */
    await waitFor(() => {
      expect(
        queryClient.getQueryData(pushKeys.thisBrowser('11111111-1111-4111-8111-111111111111')),
      ).toBe('on')
    })

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

  it('explains the one unavoidable Home Screen step in an ordinary iPhone tab', async () => {
    install({ push: false, ios: true })
    const queryClient = renderBanner()
    await settled(queryClient)

    expect(screen.getByText(m.chat_push_ios_hint())).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: m.chat_push_enable() })).not.toBeInTheDocument()
  })

  it('can be put away, and stays away', async () => {
    const user = userEvent.setup()
    install({})
    renderBanner()

    await user.click(await screen.findByRole('button', { name: m.chat_push_banner_dismiss() }))

    await waitFor(() => {
      expect(screen.queryByText(m.chat_push_banner_title())).not.toBeInTheDocument()
    })
    // ⚠ A shared workshop browser must not carry this dismissal to the next signed-in person.
    expect(
      localStorage.getItem(
        'mrr:internal:chat:push-banner-dismissed:11111111-1111-4111-8111-111111111111',
      ),
    ).toBe('1')
  })
})
