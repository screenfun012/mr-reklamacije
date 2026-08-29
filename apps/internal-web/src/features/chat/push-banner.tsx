import { m } from '@mr/i18n'
import { BellRing, X } from 'lucide-react'

import { useStoredFlag } from '~/lib/use-stored-flag'

import { usePushEnrollment } from './use-push-enrollment'

/**
 * Per BROWSER, like DND beside it — dismissing on the office computer must not silence the offer
 * on the phone, which is the device the whole feature is for.
 */
const DISMISSED_KEY = 'mrr:internal:chat:push-banner-dismissed'

/**
 * The one press, where nobody can miss it.
 *
 * The switch at the foot of the conversation list is found only by somebody already looking for it,
 * and push that half the shop never turns on is worse than none: the people who did turn it on
 * start assuming everybody was told.
 *
 * ⚠ It offers, it does not ask. The permission prompt fires on the press below and never on load —
 * an unasked-for prompt is answered with Block, and Block is permanent.
 */
export function PushBanner({ userId }: { userId: string }): React.ReactElement | null {
  return <PushBannerForUser key={userId} userId={userId} />
}

function PushBannerForUser({ userId }: { userId: string }): React.ReactElement | null {
  const { enrollment, asking, enable } = usePushEnrollment(userId)
  const [dismissed, setDismissed] = useStoredFlag(`${DISMISSED_KEY}:${userId}`, false)
  const canEnable = enrollment === 'off' || enrollment === 'failed'
  const needsIosInstall = enrollment === 'ios-needs-home-screen'

  if ((!canEnable && !needsIosInstall) || dismissed) {
    return null
  }

  return (
    <div className="relative flex flex-none items-center gap-3 border-b border-mri-border bg-mri-inbg px-4 py-2.5">
      <BellRing aria-hidden="true" className="size-[15px] flex-none text-mri-red" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] font-bold text-mri-text">{m.chat_push_banner_title()}</span>
        <span className="text-[10.5px] leading-[1.4] text-mri-text2">
          {needsIosInstall ? m.chat_push_ios_hint() : m.chat_push_banner_body()}
        </span>
      </span>
      {canEnable ? (
        <button
          type="button"
          disabled={asking}
          onClick={() => void enable()}
          className="h-8 flex-none rounded-[7px] bg-mri-btn px-3 text-[11px] font-bold whitespace-nowrap text-mri-btnfg transition-transform hover:-translate-y-px disabled:opacity-60"
        >
          {m.chat_push_enable()}
        </button>
      ) : null}
      <button
        type="button"
        title={m.chat_push_banner_dismiss()}
        onClick={() => setDismissed(true)}
        className="relative grid size-6 flex-none cursor-pointer place-items-center rounded-[6px] text-mri-text2 transition-colors after:absolute after:-inset-2 hover:bg-mri-rowhv hover:text-mri-text"
      >
        {/* ⚠ It can be put away, and that is deliberate. A bar nobody can dismiss is a bar people
            learn to look past — and the switch in the list stays as the way back. */}
        <X aria-hidden="true" className="size-3.5" />
        <span className="sr-only">{m.chat_push_banner_dismiss()}</span>
      </button>
    </div>
  )
}
