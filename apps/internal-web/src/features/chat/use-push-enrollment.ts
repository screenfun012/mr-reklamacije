import { m } from '@mr/i18n'
import {
  pushDevicesOptions,
  pushKeys,
  pushPublicKeyOptions,
  subscribeToPush,
  type PushDevice,
} from '@mr/shared'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

/**
 * What this browser can be offered.
 *
 * `no-keys` — the SERVER is not configured for push. Show nothing at all: it is our own setup, not
 * anything the person could act on, and a sentence about it would only puzzle them.
 * `unsupported` — the browser genuinely cannot. Worth saying, so nobody hunts for a switch that is
 * not there.
 * `ios-needs-home-screen` — an iPhone or iPad not yet added to the Home Screen. Apple allows no
 * push before that, so the only useful thing to show is what to do about it.
 * `off` — it can be turned on, and has not been.
 * `on` — it is on, on this browser.
 *
 * ⚠ The first two were one value in the first draft, and a test caught it: collapsing them silences
 * the one case a person can actually do something about.
 */
export type PushEnrollment = 'no-keys' | 'unsupported' | 'ios-needs-home-screen' | 'off' | 'on'

/**
 * Whether this browser can be told anything at all.
 *
 * ⚠ Feature detection, never a user-agent string. On iPhone and iPad `PushManager` is simply absent
 * until the app is added to the Home Screen — asking "is it there" answers the real question, and
 * keeps answering it correctly the day Apple changes its mind.
 */
function pushIsPossible(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** Safari calls the app "standalone" once it has been added to the Home Screen. */
function looksLikeIosWithoutHomeScreen(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const standalone = (navigator as { standalone?: boolean }).standalone === true
  return isIos && !standalone && !('PushManager' in window)
}

/**
 * The base64url the server hands out, in the byte form `PushManager.subscribe` insists on.
 * ⚠ It refuses the string outright — this conversion is not decoration.
 */
function toApplicationServerKey(base64Url: string): ArrayBuffer {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), '=')
  const binary = atob(padded.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = Uint8Array.from(binary, (character) => character.codePointAt(0) ?? 0)
  return bytes.buffer.slice(0) as ArrayBuffer
}

export interface PushEnrollmentState {
  enrollment: PushEnrollment
  devices: PushDevice[]
  asking: boolean
  enable: () => Promise<void>
}

/**
 * Everything both the banner and the switch need to know, in ONE place.
 *
 * ⚠ Written once deliberately. Two copies of "may we offer this here" drift, and the way they drift
 * is one of them offering a button on a device that cannot use it — or worse, staying silent on one
 * that can.
 */
export function usePushEnrollment(): PushEnrollmentState {
  const queryClient = useQueryClient()
  const publicKey = useQuery(pushPublicKeyOptions())
  const devices = useQuery(pushDevicesOptions())
  const [asking, setAsking] = useState(false)

  const key = publicKey.data?.publicKey ?? null
  const items = devices.data?.items ?? []

  const enable = async (): Promise<void> => {
    if (key === null) {
      return
    }

    setAsking(true)
    try {
      /*
       * ⚠ Asked HERE, on a press — never on load.
       *
       * A prompt nobody asked for is answered with Block, and Block is PERMANENT: the app can
       * never ask again, and the only cure is the browser's own site settings. Asking at the wrong
       * moment does not lose a click, it loses the person.
       */
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        showInternalToast(m.chat_push_blocked())
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push nobody can see is a push anybody could abuse.
        userVisibleOnly: true,
        applicationServerKey: toApplicationServerKey(key),
      })

      const raw = subscription.toJSON()
      await subscribeToPush({
        endpoint: subscription.endpoint,
        keys: { p256dh: raw.keys?.['p256dh'] ?? '', auth: raw.keys?.['auth'] ?? '' },
      })
      await queryClient.invalidateQueries({ queryKey: pushKeys.devices() })
    } catch {
      showInternalToast(m.chat_push_failed())
    } finally {
      setAsking(false)
    }
  }

  const enrollment: PushEnrollment =
    key === null
      ? 'no-keys'
      : !pushIsPossible()
        ? looksLikeIosWithoutHomeScreen()
          ? 'ios-needs-home-screen'
          : 'unsupported'
        : items.length > 0
          ? 'on'
          : 'off'

  return { enrollment, devices: items, asking, enable }
}
