import { m } from '@mr/i18n'
import {
  pushDevicesOptions,
  pushKeys,
  pushPublicKeyOptions,
  removePushDevice,
  subscribeToPush,
  type PushDevice,
} from '@mr/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

import { registerServiceWorker } from '~/lib/register-service-worker'
import { showInternalToast } from '~/lib/internal-toast'

const SERVICE_WORKER_READY_TIMEOUT_MS = 5000
const OPT_OUT_KEY_PREFIX = 'mrr:internal:push-disabled:'

export type PushEnrollment =
  | 'no-keys'
  | 'unsupported'
  | 'ios-needs-home-screen'
  | 'unknown'
  | 'off'
  | 'on'
  | 'blocked'
  | 'failed'

function pushIsPossible(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

function looksLikeIosWithoutHomeScreen(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isIpadDesktopUa = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  const standalone = (navigator as { standalone?: boolean }).standalone === true
  return (isIos || isIpadDesktopUa) && !standalone && !('PushManager' in window)
}

function toApplicationServerKey(base64Url: string): ArrayBuffer {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=')
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0)
  return bytes.buffer.slice(0) as ArrayBuffer
}

function applicationServerKeyMatches(subscription: PushSubscription, publicKey: string): boolean {
  const current = subscription.options?.applicationServerKey
  if (current === null || current === undefined) {
    return false
  }

  try {
    const expected = new Uint8Array(toApplicationServerKey(publicKey))
    const actual = new Uint8Array(current)
    return (
      actual.length === expected.length && actual.every((value, index) => value === expected[index])
    )
  } catch {
    return false
  }
}

function optOutKey(userId: string): string {
  return `${OPT_OUT_KEY_PREFIX}${userId}`
}

function isOptedOut(userId: string): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(optOutKey(userId)) === '1'
}

function setOptedOut(userId: string, optedOut: boolean): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  if (optedOut) {
    localStorage.setItem(optOutKey(userId), '1')
  } else {
    localStorage.removeItem(optOutKey(userId))
  }
}

function notificationPermission(): NotificationPermission {
  const permission = Notification.permission
  return permission === 'granted' || permission === 'denied' ? permission : 'default'
}

function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(
      () => reject(new Error('Service worker readiness timed out')),
      SERVICE_WORKER_READY_TIMEOUT_MS,
    )
  })

  return Promise.race([
    registerServiceWorker().then(() => navigator.serviceWorker.ready),
    timeoutPromise,
  ]).finally(() => {
    if (timeout !== undefined) {
      clearTimeout(timeout)
    }
  })
}

function postSubscription(subscription: PushSubscription): Promise<void> {
  const raw = subscription.toJSON()
  return subscribeToPush({
    endpoint: subscription.endpoint,
    keys: { p256dh: raw.keys?.['p256dh'] ?? '', auth: raw.keys?.['auth'] ?? '' },
  })
}

async function subscribe(
  registration: ServiceWorkerRegistration,
  publicKey: string,
): Promise<PushSubscription> {
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: toApplicationServerKey(publicKey),
  })
}

async function bindThisBrowser(publicKey: string): Promise<'on' | 'off' | 'blocked'> {
  const permission = notificationPermission()
  if (permission === 'denied') {
    return 'blocked'
  }
  if (permission !== 'granted') {
    return 'off'
  }

  const registration = await waitForServiceWorker()
  let subscription = await registration.pushManager.getSubscription()
  if (subscription !== null && !applicationServerKeyMatches(subscription, publicKey)) {
    await subscription.unsubscribe()
    subscription = null
  }
  if (subscription === null) {
    subscription = await subscribe(registration, publicKey)
  }

  await postSubscription(subscription)
  return 'on'
}

export interface PushEnrollmentState {
  enrollment: PushEnrollment
  devices: PushDevice[]
  asking: boolean
  enable: () => Promise<void>
  disableThisDevice: () => Promise<void>
}

export function usePushEnrollment(
  userId: string,
  { reconcile = true, loadDevices = false }: { reconcile?: boolean; loadDevices?: boolean } = {},
): PushEnrollmentState {
  const queryClient = useQueryClient()
  const isBrowser = typeof window !== 'undefined'
  const publicKey = useQuery({
    ...pushPublicKeyOptions(),
    enabled: isBrowser && userId !== '',
  })
  const devices = useQuery({
    ...pushDevicesOptions(userId),
    enabled: isBrowser && userId !== '' && loadDevices,
  })
  const [asking, setAsking] = useState(false)

  const key = publicKey.data?.publicKey ?? null
  const items = devices.data?.items ?? []
  const thisBrowser = useQuery({
    queryKey: pushKeys.thisBrowser(userId),
    queryFn: () =>
      isOptedOut(userId) ? Promise.resolve('off' as const) : bindThisBrowser(key ?? ''),
    enabled: isBrowser && reconcile && userId !== '' && key !== null && pushIsPossible(),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  useEffect(() => {
    if (!isBrowser || userId === '' || key === null || !pushIsPossible()) return

    const refreshChangedPermission = (): void => {
      if (document.visibilityState !== 'visible') return
      const current = queryClient.getQueryData<PushEnrollment>(pushKeys.thisBrowser(userId))
      const permission = notificationPermission()

      if (current === 'on' && permission !== 'granted') {
        queryClient.setQueryData(
          pushKeys.thisBrowser(userId),
          permission === 'denied' ? 'blocked' : 'off',
        )
      } else if (
        (current === 'blocked' && permission !== 'denied') ||
        (current === 'off' && permission === 'granted')
      ) {
        void queryClient.invalidateQueries({ queryKey: pushKeys.thisBrowser(userId) })
      }
    }

    window.addEventListener('focus', refreshChangedPermission)
    document.addEventListener('visibilitychange', refreshChangedPermission)
    return () => {
      window.removeEventListener('focus', refreshChangedPermission)
      document.removeEventListener('visibilitychange', refreshChangedPermission)
    }
  }, [isBrowser, key, queryClient, userId])

  useEffect(() => {
    if (reconcile && thisBrowser.data === 'on') {
      void queryClient.invalidateQueries({ queryKey: pushKeys.devices(userId) })
    }
  }, [queryClient, reconcile, thisBrowser.data, userId])

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: pushKeys.devices(userId) })
  }

  const enable = async (): Promise<void> => {
    if (key === null) {
      return
    }

    setAsking(true)
    try {
      setOptedOut(userId, false)
      const permission = await Notification.requestPermission()
      if (permission === 'denied') {
        queryClient.setQueryData(pushKeys.thisBrowser(userId), 'blocked')
        showInternalToast(m.chat_push_blocked())
        return
      }
      if (permission !== 'granted') {
        queryClient.setQueryData(pushKeys.thisBrowser(userId), 'off')
        return
      }

      const next = await bindThisBrowser(key)
      queryClient.setQueryData(pushKeys.thisBrowser(userId), next)
      await refresh()
    } catch {
      showInternalToast(m.chat_push_failed())
    } finally {
      setAsking(false)
    }
  }

  const disableThisDevice = async (): Promise<void> => {
    setOptedOut(userId, true)
    setAsking(true)
    const current = items.find((device) => device.isCurrent)
    const localCleanup = waitForServiceWorker().then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription !== null) {
        await subscription.unsubscribe()
      }
    })
    const serverCleanup = current === undefined ? Promise.resolve() : removePushDevice(current.id)
    const results = await Promise.allSettled([localCleanup, serverCleanup])
    queryClient.setQueryData(pushKeys.thisBrowser(userId), 'off')
    let failed = results.some((result) => result.status === 'rejected')
    try {
      await refresh()
    } catch {
      failed = true
    }
    if (failed) {
      showInternalToast(m.chat_push_failed())
    }
    setAsking(false)
  }

  const enrollment: PushEnrollment =
    key === null
      ? 'no-keys'
      : !pushIsPossible()
        ? looksLikeIosWithoutHomeScreen()
          ? 'ios-needs-home-screen'
          : 'unsupported'
        : thisBrowser.isError
          ? 'failed'
          : thisBrowser.data === undefined
            ? 'unknown'
            : thisBrowser.data

  return { enrollment, devices: items, asking, enable, disableThisDevice }
}
