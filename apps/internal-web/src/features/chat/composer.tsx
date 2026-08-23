import { m } from '@mr/i18n'
import { CHAT_MESSAGE_MAX_LENGTH, type MrRegistryExistingClaim } from '@mr/shared'
import { Camera, Paperclip } from 'lucide-react'
import { useState } from 'react'

import { ComposerMrSuggestion } from './composer-mr-suggestion'

/** The four the prototype offers. Whole sentences of this shop's day, not a phrasebook. */
const QUICK_REPLIES = [
  m.chat_quick_engine_arrived,
  m.chat_quick_report_done,
  m.chat_quick_on_my_way,
  m.chat_quick_picked_up,
] as const

const INERT_BUTTON_CLASSES =
  'grid h-10 w-9 flex-none place-items-center rounded-[9px] border border-mri-border2 text-mri-text2 disabled:cursor-not-allowed disabled:opacity-60'

export interface ComposerProps {
  isThread: boolean
  onSend: (body: string) => void
  /** The conversation being written in — so the offer never points at the room you are in. */
  conversationId?: string | undefined
  /**
   * What happens when somebody takes up the offer above the field. Absent where there is nowhere
   * to go, and then no offer is made — the same rule the MR chip in a message follows.
   */
  onOpenClaim?: ((target: MrRegistryExistingClaim) => void) | undefined
}

/** What a person writes, and the two buttons beside it that do not work yet and say so. */
export function Composer({
  isThread,
  onSend,
  conversationId,
  onOpenClaim,
}: ComposerProps): React.ReactElement {
  const [text, setText] = useState('')

  const submit = (): void => {
    const body = text.trim()
    if (body === '') {
      return
    }
    onSend(body)
    setText('')
  }

  return (
    <div className="flex flex-none flex-col border-t border-mri-border bg-mri-surface">
      {onOpenClaim === undefined ? null : (
        <ComposerMrSuggestion
          draft={text}
          conversationId={conversationId}
          onOpenClaim={onOpenClaim}
        />
      )}
      <div className="flex flex-wrap items-center gap-[7px] px-4 pt-2.5">
        <span className="font-mono text-[8px] font-semibold tracking-[0.16em] text-mri-text2">
          {m.chat_composer_quick()}
        </span>
        {QUICK_REPLIES.map((quick) => (
          <button
            key={quick()}
            type="button"
            // Into the field, never out the door: a chip that sent on its own would put an
            // unfinished sentence in front of the whole shop.
            onClick={() =>
              setText((current) => (current === '' ? quick() : `${current} ${quick()}`))
            }
            className="rounded-[20px] border border-mri-border2 px-[11px] py-[5px] text-[11px] font-semibold text-mri-text2 transition-colors hover:border-mri-text2 hover:text-mri-text"
          >
            {quick()}
          </button>
        ))}
      </div>

      <div className="flex items-end gap-[9px] px-4 pt-2.5 pb-3">
        <button
          type="button"
          disabled
          title={m.chat_attach_title()}
          className={INERT_BUTTON_CLASSES}
        >
          <Paperclip aria-hidden="true" className="size-[15px]" />
          <span className="sr-only">{m.chat_attach()}</span>
        </button>
        <button
          type="button"
          disabled
          title={m.chat_camera_title()}
          className={INERT_BUTTON_CLASSES}
        >
          <Camera aria-hidden="true" className="size-[15px]" />
          <span className="sr-only">{m.chat_camera()}</span>
        </button>

        {/*
          A textarea rather than the prototype's `<input>`, and it is the only way both rules can
          hold at once: the prototype draws one 40px line, and Shift+Enter has to make a second one
          — which an `<input>` cannot hold at all. At rest it is the prototype's box to the pixel.
        */}
        <textarea
          rows={1}
          value={text}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          aria-label={m.chat_composer_label()}
          placeholder={
            isThread ? m.chat_composer_placeholder_thread() : m.chat_composer_placeholder()
          }
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          className="h-10 min-w-0 flex-1 resize-none rounded-[9px] border border-mri-border2 bg-mri-inbg px-[13px] py-[10px] text-[13px] leading-[18px] font-medium text-mri-text outline-none placeholder:text-mri-text2 focus:border-mri-red focus:shadow-[0_0_0_3px_rgba(237,28,36,.18)]"
        />

        <button
          type="button"
          onClick={submit}
          disabled={text.trim() === ''}
          className="h-10 flex-none rounded-[9px] bg-mri-btn px-[18px] text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-mri-btnfg shadow-[0_8px_22px_rgba(0,0,0,.4)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {m.chat_composer_send()}
        </button>
      </div>
    </div>
  )
}
