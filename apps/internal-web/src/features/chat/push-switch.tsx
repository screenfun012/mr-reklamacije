import { m } from '@mr/i18n'
import { PushSubscriptionMode, pushKeys, setPushMode } from '@mr/shared'
import { cn } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'

import { showInternalToast } from '~/lib/internal-toast'

import { usePushEnrollment } from './use-push-enrollment'

const EYEBROW_CLASSES = 'font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2'

const HINT_CLASSES = 'text-[10.5px] leading-[1.45] text-mri-text2'

const MODES = [
  { value: PushSubscriptionMode.All, label: m.chat_push_mode_all },
  { value: PushSubscriptionMode.Mentions, label: m.chat_push_mode_mentions },
  { value: PushSubscriptionMode.NoText, label: m.chat_push_mode_no_text },
] as const

/** Marks the row owned by the authenticated session, never by a user-agent comparison. */
function deviceLabel(userAgent: string | null, isCurrent: boolean): string {
  const label = userAgent ?? ''
  return isCurrent ? `${label} · ${m.chat_push_this_device()}` : label
}

export function PushSwitch({
  userId,
  reconcile = false,
}: {
  userId: string
  /** Isolated tests may make the panel own reconciliation; the shell owns it in the app. */
  reconcile?: boolean
}): React.ReactElement | null {
  const queryClient = useQueryClient()
  const { enrollment, devices, asking, disableThisDevice, enable } = usePushEnrollment(userId, {
    reconcile,
    loadDevices: true,
  })

  const changeMode = useMutation({
    mutationFn: setPushMode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: pushKeys.devices(userId) }),
    onError: () => showInternalToast(m.chat_push_failed()),
  })

  // Our own setup, not anything the person could act on — so nothing is said at all. And nothing
  // at all until the browser has answered: a panel that offers and then withdraws reads as a fault.
  if (enrollment === 'no-keys' || enrollment === 'unknown') {
    return null
  }

  const mode = devices[0]?.mode ?? PushSubscriptionMode.All

  return (
    <div className="flex flex-col gap-2 border-t border-mri-border px-3 py-3">
      <span className={EYEBROW_CLASSES}>{m.chat_push_eyebrow()}</span>

      {enrollment === 'ios-needs-home-screen' ||
      enrollment === 'unsupported' ||
      enrollment === 'blocked' ? (
        <p className={HINT_CLASSES}>
          {/* ⚠ Says WHY rather than showing nothing. On an iPad this is the one sentence between a
              serviser and a phone that never rings. */}
          {enrollment === 'ios-needs-home-screen'
            ? m.chat_push_ios_hint()
            : enrollment === 'unsupported'
              ? m.chat_push_unsupported()
              : m.chat_push_blocked()}
        </p>
      ) : enrollment === 'off' || enrollment === 'failed' ? (
        <>
          {enrollment === 'failed' ? <p className={HINT_CLASSES}>{m.chat_push_failed()}</p> : null}
          <button
            type="button"
            disabled={asking}
            onClick={() => void enable()}
            className="h-8 rounded-[7px] border border-mri-border2 px-3 text-[11px] font-semibold text-mri-text transition-colors hover:border-mri-text2 disabled:opacity-60"
          >
            {m.chat_push_enable()}
          </button>
        </>
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
            {devices.map((device) => (
              <li key={device.id} className="flex items-center gap-1.5">
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-mri-text2">
                  {deviceLabel(device.userAgent, device.isCurrent)}
                </span>
                {device.isCurrent ? (
                  <button
                    type="button"
                    title={m.chat_push_device_remove()}
                    disabled={asking}
                    onClick={() => void disableThisDevice()}
                    className="relative grid size-5 flex-none cursor-pointer place-items-center rounded-[5px] text-mri-text2 transition-colors after:absolute after:-inset-2.5 hover:bg-mri-rowhv hover:text-mri-bad disabled:opacity-60"
                  >
                    <X aria-hidden="true" className="size-3" />
                    <span className="sr-only">{m.chat_push_device_remove()}</span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
