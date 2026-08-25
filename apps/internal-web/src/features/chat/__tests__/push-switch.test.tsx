import { m, setLocale } from '@mr/i18n'
import { PushSubscriptionMode, pushKeys } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PushSwitch } from '~/features/chat/push-switch'

const ORIGINAL_NAVIGATOR = globalThis.navigator

/** What `pushManager.getSubscription()` hands back on a browser that is already subscribed. */
const BROWSER_SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/ovaj-pregledac',
  toJSON: () => ({ keys: { p256dh: 'kljuc', auth: 'tajna' } }),
}

const REPLACED_BROWSER_SUBSCRIPTION = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/novi-kljuc',
  toJSON: () => ({ keys: { p256dh: 'novi-kljuc', auth: 'nova-tajna' } }),
}

interface Options {
  publicKey?: string | null
  devices?: Array<{
    id: string
    userAgent: string | null
    mode: string
    createdAt: string
    isCurrent?: boolean
  }>
  /** Whether THIS browser holds a subscription — which is a different question from the list. */
  subscribedHere?: boolean
  applicationServerKey?: ArrayBuffer
  onUnsubscribe?: () => void
  onSubscribe?: () => void
  serviceWorkerReadyError?: Error
  permission?: NotificationPermission
  push?: boolean
  ios?: boolean
}

function install({
  publicKey = 'AQID',
  devices = [],
  subscribedHere = false,
  applicationServerKey,
  onUnsubscribe,
  onSubscribe,
  serviceWorkerReadyError,
  permission,
  push = true,
  ios = false,
}: Options): void {
  let subscribed = subscribedHere
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('/public-key')) {
      return Response.json({ publicKey })
    }
    return Response.json({
      items: devices.map((device) => ({ ...device, isCurrent: device.isCurrent ?? true })),
      total: devices.length,
      page: 1,
      pageSize: 10,
    })
  }) as unknown as typeof fetch

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      ...ORIGINAL_NAVIGATOR,
      serviceWorker: {
        register: vi.fn().mockResolvedValue(undefined),
        get ready() {
          if (serviceWorkerReadyError !== undefined) {
            return Promise.reject(serviceWorkerReadyError)
          }
          return Promise.resolve({
            pushManager: {
              getSubscription: async () =>
                subscribed
                  ? {
                      ...BROWSER_SUBSCRIPTION,
                      options:
                        applicationServerKey === undefined ? undefined : { applicationServerKey },
                      unsubscribe: async () => {
                        subscribed = false
                        onUnsubscribe?.()
                        return true
                      },
                    }
                  : null,
              subscribe: async () => {
                subscribed = true
                onSubscribe?.()
                return REPLACED_BROWSER_SUBSCRIPTION
              },
            },
          })
        },
      },
      userAgent: ios ? 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Safari' : 'Chrome',
    },
  })

  const scope = globalThis as unknown as Record<string, unknown>
  if (push) {
    // jsdom has neither, and noticing that is the component's whole job.
    scope['PushManager'] = class {}
    scope['Notification'] = class {
      static permission = permission ?? (subscribedHere ? 'granted' : 'default')
      static requestPermission = vi
        .fn()
        .mockResolvedValue(permission ?? (subscribedHere ? 'granted' : 'default'))
    }
  } else {
    delete scope['PushManager']
    delete scope['Notification']
  }
}

function renderSwitch({
  reconcile = true,
  preload,
}: {
  reconcile?: boolean
  preload?: { browser: 'on'; devices: unknown }
} = {}): QueryClient {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  if (preload !== undefined) {
    queryClient.setQueryData(
      pushKeys.thisBrowser('11111111-1111-4111-8111-111111111111'),
      preload.browser,
    )
    queryClient.setQueryData(
      pushKeys.devices('11111111-1111-4111-8111-111111111111'),
      preload.devices,
    )
  }
  render(
    <QueryClientProvider client={queryClient}>
      <PushSwitch userId="11111111-1111-4111-8111-111111111111" reconcile={reconcile} />
    </QueryClientProvider>,
  )
  return queryClient
}

describe('the switch for notifications on a phone', () => {
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

  it('keeps browser enrollment state separate for each signed-in person', () => {
    expect(pushKeys.thisBrowser('11111111-1111-4111-8111-111111111111')).not.toEqual(
      pushKeys.thisBrowser('22222222-2222-4222-8222-222222222222'),
    )
  })

  it('offers nothing at all when the server has no keys', async () => {
    install({ publicKey: null })
    const queryClient = renderSwitch()

    /*
     * ⚠ Wait for the ANSWER before asserting its absence.
     *
     * The first version of this asserted straight away and passed while the query was still in
     * flight — so it stayed green even with the `publicKey === null` check deleted. A negative
     * assertion made before the system has done any work proves nothing at all; mutation testing
     * is what showed it.
     */
    await waitFor(() => {
      expect(queryClient.getQueryData(pushKeys.publicKey())).toEqual({ publicKey: null })
    })

    // Not a dead button: `subscribe` cannot be called without a key, so a button here could only
    // ever fail.
    expect(screen.queryByText(m.chat_push_eyebrow())).not.toBeInTheDocument()
  })

  /**
   * The sentence that stands between a serviser and a phone that never rings.
   *
   * On an iPhone or iPad there is no push at all until the app is added to the Home Screen — so the
   * switch must say WHY it cannot be offered rather than simply not be there.
   */
  it('tells an iPad what to do instead of staying silent', async () => {
    install({ push: false, ios: true })
    renderSwitch()

    expect(await screen.findByText(m.chat_push_ios_hint())).toBeInTheDocument()
  })

  it('says plainly when a browser simply cannot', async () => {
    install({ push: false, ios: false })
    renderSwitch()

    expect(await screen.findByText(m.chat_push_unsupported())).toBeInTheDocument()
  })

  it('offers to turn them on when nothing is subscribed yet', async () => {
    install({})
    renderSwitch()

    expect(await screen.findByRole('button', { name: m.chat_push_enable() })).toBeInTheDocument()
    // ⚠ And has NOT asked for permission on its own — a prompt fired on load is answered with a
    // refusal the app can never undo.
    expect(screen.queryByText(m.chat_push_mode_all())).not.toBeInTheDocument()
  })

  it('keeps the CTA available when the permission prompt is dismissed', async () => {
    const user = userEvent.setup()
    install({})
    renderSwitch()

    await user.click(await screen.findByRole('button', { name: m.chat_push_enable() }))
    expect(await screen.findByRole('button', { name: m.chat_push_enable() })).toBeInTheDocument()
    expect(screen.queryByText(m.chat_push_blocked())).not.toBeInTheDocument()
  })

  it('silently recovers after permission is unblocked in browser settings', async () => {
    const onSubscribe = vi.fn()
    install({ permission: 'denied', onSubscribe })
    renderSwitch()
    expect(await screen.findByText(m.chat_push_blocked())).toBeInTheDocument()
    ;(Notification as unknown as { permission: NotificationPermission }).permission = 'granted'
    window.dispatchEvent(new Event('focus'))

    await waitFor(() => expect(onSubscribe).toHaveBeenCalledOnce())
    expect(screen.queryByText(m.chat_push_blocked())).not.toBeInTheDocument()
  })

  it('shows the three positions and the devices once subscribed', async () => {
    install({
      subscribedHere: true,
      devices: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'iPad',
          mode: PushSubscriptionMode.NoText,
          createdAt: '2026-08-24T10:00:00.000Z',
        },
      ],
    })
    renderSwitch()

    expect(await screen.findByText(`iPad · ${m.chat_push_this_device()}`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.chat_push_mode_all() })).toBeInTheDocument()
    // The position the person is on is the one that reads as pressed.
    expect(screen.getByRole('button', { name: m.chat_push_mode_no_text() })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  /**
   * The bug Nikola hit on 2026-08-25, and the reason this file exists in its current form.
   *
   * His test account was subscribed on an iPhone. On the tablet the panel therefore read "on" —
   * the state was computed from the PERSON's device list — so the one button that would have
   * subscribed the tablet was nowhere on the screen, and the message he sent had nothing to arrive
   * at. He got it working by deleting the iPhone's row, which is the opposite of the fix.
   */
  it('still offers the button on a second device, with another one already in the list', async () => {
    install({
      subscribedHere: false,
      devices: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'iPhone',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
        },
      ],
    })
    renderSwitch()

    expect(await screen.findByRole('button', { name: m.chat_push_enable() })).toBeInTheDocument()
  })

  it('does not offer a local unsubscribe control for a remote device', async () => {
    install({
      subscribedHere: true,
      devices: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'Office iPad',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
          isCurrent: false,
        },
      ],
    })
    renderSwitch()

    expect(await screen.findByText('Office iPad')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: m.chat_push_device_remove() }),
    ).not.toBeInTheDocument()
  })

  it('unsubscribes this browser before removing only its current server row', async () => {
    const user = userEvent.setup()
    const onUnsubscribe = vi.fn()
    install({
      publicKey: 'AQID',
      subscribedHere: true,
      applicationServerKey: new Uint8Array([1, 2, 3]).buffer,
      onUnsubscribe,
      devices: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'This iPad',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
          isCurrent: true,
        },
      ],
    })
    renderSwitch()

    await user.click(await screen.findByRole('button', { name: m.chat_push_device_remove() }))
    await waitFor(() => {
      expect(onUnsubscribe).toHaveBeenCalledOnce()
      const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      expect(
        calls.some(
          (call) =>
            String(call[0]).endsWith('/api/push/devices/11111111-1111-4111-8111-111111111111') &&
            (call[1] as RequestInit | undefined)?.method === 'DELETE',
        ),
      ).toBe(true)
    })
  })

  it('removes the current server row even when local worker cleanup fails', async () => {
    const user = userEvent.setup()
    const workerError = new Error('worker stopped')
    const devices = {
      items: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'This iPad',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
          isCurrent: true,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 10,
    }
    install({ serviceWorkerReadyError: workerError })
    const queryClient = renderSwitch({ reconcile: false, preload: { browser: 'on', devices } })

    await user.click(await screen.findByRole('button', { name: m.chat_push_device_remove() }))
    await waitFor(() => {
      const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      expect(
        calls.some(
          (call) =>
            String(call[0]).endsWith('/api/push/devices/11111111-1111-4111-8111-111111111111') &&
            (call[1] as RequestInit | undefined)?.method === 'DELETE',
        ),
      ).toBe(true)
    })
    expect(
      queryClient.getQueryData(pushKeys.thisBrowser('11111111-1111-4111-8111-111111111111')),
    ).toBe('off')
  })

  it('labels only the server-marked device as current when user agents match', async () => {
    install({
      publicKey: 'AQID',
      subscribedHere: true,
      applicationServerKey: new Uint8Array([1, 2, 3]).buffer,
      devices: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'Chrome',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
          isCurrent: true,
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          userAgent: 'Chrome',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
          isCurrent: false,
        },
      ],
    })
    renderSwitch()

    expect(await screen.findByText(`Chrome · ${m.chat_push_this_device()}`)).toBeInTheDocument()
    expect(screen.getAllByText('Chrome')).toHaveLength(1)
  })

  it('keeps a disabled browser opted out after a cold remount without affecting another user', async () => {
    const user = userEvent.setup()
    const onSubscribe = vi.fn()
    install({
      publicKey: 'AQID',
      subscribedHere: true,
      applicationServerKey: new Uint8Array([1, 2, 3]).buffer,
      onSubscribe,
      devices: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'This iPad',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
          isCurrent: true,
        },
      ],
    })
    renderSwitch()

    await user.click(await screen.findByRole('button', { name: m.chat_push_device_remove() }))
    await waitFor(() => expect(onSubscribe).not.toHaveBeenCalled())

    const remount = renderSwitch()
    await waitFor(() => {
      expect(
        remount.getQueryData(pushKeys.thisBrowser('11111111-1111-4111-8111-111111111111')),
      ).toBe('off')
    })
    expect(onSubscribe).not.toHaveBeenCalled()
    expect(
      localStorage.getItem('mrr:internal:push-disabled:11111111-1111-4111-8111-111111111111'),
    ).toBe('1')
    expect(
      localStorage.getItem('mrr:internal:push-disabled:22222222-2222-4222-8222-222222222222'),
    ).toBeNull()
  })

  /**
   * The same fault seen from the other side: a browser that IS subscribed while the server has
   * forgotten its row — somebody deleted it from another device, or a rotated key made the send
   * path drop it. Nothing on that phone would ever have said so.
   */
  it('tells the server again about a subscription its list no longer holds', async () => {
    install({ subscribedHere: true, devices: [] })
    renderSwitch()

    // It reads as on, because the browser says it is on.
    expect(await screen.findByRole('button', { name: m.chat_push_mode_all() })).toBeInTheDocument()
    await waitFor(() => {
      const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      const post = calls.find(
        (call) =>
          String(call[0]).endsWith('/api/push/devices') &&
          (call[1] as RequestInit | undefined)?.method === 'POST',
      )
      expect(post).toBeDefined()
    })
  })

  it('replaces a browser subscription when its VAPID key changed', async () => {
    const onUnsubscribe = vi.fn()
    install({
      publicKey: 'AQID',
      subscribedHere: true,
      applicationServerKey: new Uint8Array([4, 5, 6]).buffer,
      onUnsubscribe,
    })
    renderSwitch()

    expect(await screen.findByRole('button', { name: m.chat_push_mode_all() })).toBeInTheDocument()
    await waitFor(() => {
      expect(onUnsubscribe).toHaveBeenCalledOnce()
      const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      expect(calls.some((call) => String(call[1]?.body).includes('novi-kljuc'))).toBe(true)
    })
  })

  it('replaces a subscription whose browser cannot report its VAPID key', async () => {
    const onUnsubscribe = vi.fn()
    install({ publicKey: 'AQID', subscribedHere: true, onUnsubscribe })
    renderSwitch()

    expect(await screen.findByRole('button', { name: m.chat_push_mode_all() })).toBeInTheDocument()
    await waitFor(() => expect(onUnsubscribe).toHaveBeenCalledOnce())
  })

  it('offers the one CTA again after a silent repair fails', async () => {
    install({
      publicKey: 'not a vapid key',
      subscribedHere: true,
      applicationServerKey: new Uint8Array([4]).buffer,
    })
    renderSwitch()

    expect(await screen.findByText(m.chat_push_failed())).toBeInTheDocument()
    expect(screen.getByRole('button', { name: m.chat_push_enable() })).toBeInTheDocument()
  })

  it('moves the switch for the person, not for the device that was tapped', async () => {
    const user = userEvent.setup()
    install({
      subscribedHere: true,
      devices: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          userAgent: 'iPad',
          mode: PushSubscriptionMode.All,
          createdAt: '2026-08-24T10:00:00.000Z',
        },
      ],
    })
    renderSwitch()

    await user.click(await screen.findByRole('button', { name: m.chat_push_mode_mentions() }))

    await waitFor(() => {
      const calls = (global.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      expect(calls.find((call) => String(call[0]).endsWith('/api/push/mode'))).toBeDefined()
    })
  })
})
