import { m } from '@mr/i18n'
import {
  PushSubscriptionMode,
  pushDevicesOptions,
  pushKeys,
  pushPublicKeyOptions,
  removePushDevice,
  setPushMode,
  subscribeToPush,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

const EYEBROW_CLASSES = 'font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2'

const HINT_CLASSES = 'text-[10.5px] leading-[1.45] text-mri-text2'

const MODES = [
  { value: PushSubscriptionMode.All, label: m.chat_push_mode_all },
  { value: PushSubscriptionMode.Mentions, label: m.chat_push_mode_mentions },
  { value: PushSubscriptionMode.NoText, label: m.chat_push_mode_no_text },
] as const

/**
 * Whether this browser can be told anything at all.
 *
 * ⚠ Feature detection, never a user-agent string. On iPhone and iPad `PushManager` is simply absent
 * until the app is added to the Home Screen — so asking "is it there" answers the real question,
 * and keeps answering it correctly the day Apple changes its mind.
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
  // The `ArrayBuffer` rather than the view: TypeScript's DOM types accept a plain BufferSource,
  // and a `Uint8Array` over a SharedArrayBuffer is not one of them.
  return bytes.buffer.slice(0) as ArrayBuffer
}

/**
 * „Obaveštenja na telefon", under the DND switch — where a person is already thinking about being
 * disturbed.
 */
export function PushSwitch(): React.ReactElement | null {
  const queryClient = useQueryClient()
  const publicKey = useQuery(pushPublicKeyOptions())
  const devices = useQuery(pushDevicesOptions())
  const [asking, setAsking] = useState(false)

  /*
   * ⚠ Every hook BEFORE the early return below.
   *
   * These sat after it in the first version, so the moment the server's answer arrived the render
   * went from four hooks to six and React threw the whole tree away — the panel would have died
   * exactly when push became available. The test caught it; the rule is that a hook is never
   * conditional, and an early return is a condition.
   */
  const changeMode = useMutation({
    mutationFn: setPushMode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pushKeys.devices() }),
    onError: () => showInternalToast(m.chat_push_failed()),
  })

  const dropDevice = useMutation({
    mutationFn: removePushDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pushKeys.devices() }),
    onError: () => showInternalToast(m.chat_push_failed()),
  })

  // Nothing to offer: the server has no VAPID keys, so `subscribe` could not be called anyway.
  if (publicKey.data?.publicKey === null || publicKey.data === undefined) {
    return null
  }

  const key = publicKey.data.publicKey

  const mode = devices.data?.items[0]?.mode ?? PushSubscriptionMode.All
  const subscribed = (devices.data?.items.length ?? 0) > 0

  const enable = async (): Promise<void> => {
    setAsking(true)
    try {
      // ⚠ Asked HERE, on a press — never on load. A prompt fired at load is answered with a
      // permanent refusal that the app can never undo.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        showInternalToast(m.chat_push_blocked())
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        // Required by every browser: a push that anybody could send to is not a push.
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

  return (
    <div className="flex flex-col gap-2 border-t border-mri-border px-3 py-3">
      <span className={EYEBROW_CLASSES}>{m.chat_push_eyebrow()}</span>

      {!pushIsPossible() ? (
        <p className={HINT_CLASSES}>
          {/* ⚠ Says WHY rather than showing nothing. On an iPad this is the one sentence between a
              serviser and a phone that never rings. */}
          {looksLikeIosWithoutHomeScreen() ? m.chat_push_ios_hint() : m.chat_push_unsupported()}
        </p>
      ) : !subscribed ? (
        <button
          type="button"
          disabled={asking}
          onClick={() => void enable()}
          className="h-8 rounded-[7px] border border-mri-border2 px-3 text-[11px] font-semibold text-mri-text transition-colors hover:border-mri-text2 disabled:opacity-60"
        >
          {m.chat_push_enable()}
        </button>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            {MODES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={mode === option.value}
                onClick={() => changeMode.mutate(option.value)}
                className={cn(
                  'h-7 rounded-[6px] border px-2 text-[10.5px] font-semibold transition-colors',
                  mode === option.value
                    ? 'border-mri-red text-mri-red'
                    : 'border-mri-border2 text-mri-text2 hover:border-mri-text2',
                )}
              >
                {option.label()}
              </button>
            ))}
          </div>

          <span className={EYEBROW_CLASSES}>{m.chat_push_devices()}</span>
          <ul className="flex flex-col gap-1">
            {(devices.data?.items ?? []).map((device) => (
              <li key={device.id} className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-mri-text2">
                  {device.userAgent ?? m.chat_push_this_device()}
                </span>
                <button
                  type="button"
                  title={m.chat_push_device_remove()}
                  onClick={() => dropDevice.mutate(device.id)}
                  className="grid size-5 flex-none cursor-pointer place-items-center rounded-[5px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-bad"
                >
                  <X aria-hidden="true" className="size-3" />
                  <span className="sr-only">{m.chat_push_device_remove()}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
