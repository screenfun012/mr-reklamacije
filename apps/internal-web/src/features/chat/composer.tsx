import { m } from '@mr/i18n'
import {
  chatPeopleOptions,
  CHAT_MESSAGE_MAX_LENGTH,
  MENTION_EVERYONE_ID,
  type ChatPerson,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { Camera, Paperclip } from 'lucide-react'
import { useRef, useState } from 'react'

import { ComposerMrSuggestion } from './composer-mr-suggestion'
import {
  EMPTY_DRAFT,
  insertMention,
  reanchorMentions,
  toWireBody,
  type Draft,
} from './composer-mentions'
import { findMentionQuery, MentionMenu, mentionOptions } from './mention-menu'

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
   * Where the offer above the field lands. Absent where there is nowhere to go, and then no offer
   * is made — the same rule the MR chip in a message follows.
   */
  onOpened?: ((conversationId: string) => void) | undefined
}

/**
 * The type both halves of the field must share to the pixel. A textarea cannot hold anything but
 * text, so the colour is painted by a copy drawn BEHIND it while the real text is made
 * transparent — and that only works while every glyph sits in exactly the same place in both.
 */
const FIELD_TEXT_CLASSES = 'px-[13px] py-[10px] text-[13px] leading-[18px] font-medium'

/**
 * The words as they are written, with the addressed names coloured.
 *
 * ⚠ Background and colour ONLY. Padding or a heavier weight would make the copy's letters a
 * different width from the real ones, and the caret would drift a little further from the cursor
 * with every mention — which is worse than no colour at all. A radius costs no width, so it stays.
 */
function DraftMirror({
  draft,
  scrollTop,
}: {
  draft: Draft
  scrollTop: number
}): React.ReactElement {
  const parts: React.ReactNode[] = []
  let cursor = 0

  for (const mention of draft.mentions) {
    if (mention.start > cursor) {
      parts.push(draft.text.slice(cursor, mention.start))
    }
    parts.push(
      <span key={mention.start} className="rounded-[4px] bg-[rgba(237,28,36,0.13)] text-mri-redh">
        {draft.text.slice(mention.start, mention.end)}
      </span>,
    )
    cursor = mention.end
  }
  parts.push(draft.text.slice(cursor))

  return (
    <div
      aria-hidden="true"
      data-testid="composer-mirror"
      style={{ transform: `translateY(-${scrollTop}px)` }}
      className={cn(
        FIELD_TEXT_CLASSES,
        'pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words text-mri-text',
      )}
    >
      {parts}
    </div>
  )
}

/** What a person writes, and the two buttons beside it that do not work yet and say so. */
export function Composer({
  isThread,
  onSend,
  conversationId,
  onOpened,
}: ComposerProps): React.ReactElement {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const text = draft.text
  const [caret, setCaret] = useState(0)
  const [activeIndex, setActiveIndex] = useState(0)
  /**
   * Which `@` was dismissed with Escape. Kept as the OFFSET rather than a boolean so the menu
   * comes back for the next mention without coming back for this one on the next keystroke.
   */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  const { data: people } = useQuery({
    ...chatPeopleOptions(conversationId ?? ''),
    enabled: conversationId !== undefined,
  })

  const mention = findMentionQuery(text, caret)
  const options =
    mention === null || mention.start === dismissedAt
      ? []
      : mentionOptions(people?.items ?? [], mention.query)
  const menuOpen = options.length > 0

  const pick = (person: ChatPerson): void => {
    if (mention === null) {
      return
    }
    const label = person.id === MENTION_EVERYONE_ID ? m.chat_mention_everyone() : person.name
    const next = insertMention(draft, mention.start, caret, { id: person.id, label })
    setDraft(next.draft)
    setCaret(next.caret)
    setActiveIndex(0)
    // The caret has to be put back by hand: React re-renders the value and the browser would
    // otherwise leave it at the end of the whole field.
    requestAnimationFrame(() => {
      fieldRef.current?.focus()
      fieldRef.current?.setSelectionRange(next.caret, next.caret)
    })
  }

  const submit = (): void => {
    if (draft.text.trim() === '') {
      return
    }
    // The words are what a person wrote; the addresses are what the server is given.
    onSend(toWireBody(draft).trim())
    setDraft(EMPTY_DRAFT)
  }

  return (
    <div className="flex flex-none flex-col border-t border-mri-border bg-mri-surface">
      {onOpened === undefined ? null : (
        <ComposerMrSuggestion draft={text} conversationId={conversationId} onOpened={onOpened} />
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
            // Appended, so any address already written keeps pointing where it pointed.
            onClick={() =>
              setDraft((current) => ({
                ...current,
                text: current.text === '' ? quick() : `${current.text} ${quick()}`,
              }))
            }
            className="rounded-[20px] border border-mri-border2 px-[11px] py-[5px] text-[11px] font-semibold text-mri-text2 transition-colors hover:border-mri-text2 hover:text-mri-text"
          >
            {quick()}
          </button>
        ))}
      </div>

      <div className="relative flex items-end gap-[9px] px-4 pt-2.5 pb-3">
        {menuOpen ? (
          <MentionMenu options={options} activeIndex={activeIndex} onPick={pick} />
        ) : null}
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
        <div className="relative h-10 min-w-0 flex-1 overflow-hidden rounded-[9px] border border-mri-border2 bg-mri-inbg transition-shadow focus-within:border-mri-red focus-within:shadow-[0_0_0_3px_rgba(237,28,36,.18)]">
          <DraftMirror draft={draft} scrollTop={scrollTop} />
          <textarea
            rows={1}
            value={text}
            onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            aria-label={m.chat_composer_label()}
            placeholder={
              isThread ? m.chat_composer_placeholder_thread() : m.chat_composer_placeholder()
            }
            ref={fieldRef}
            onChange={(event) => {
              const next = event.target.value
              // The addresses follow the words: typing around a name moves it, typing INTO one ends
              // it. See `reanchorMentions` — a half-edited name must not keep addressing anybody.
              setDraft((current) => ({
                text: next,
                mentions: reanchorMentions(current.mentions, current.text, next),
              }))
              setCaret(event.target.selectionStart)
              setActiveIndex(0)
            }}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            onKeyDown={(event) => {
              // ⚠ The menu answers first. Enter while it is open CHOOSES — otherwise picking
              // somebody would post the unfinished sentence to the whole shop.
              if (menuOpen) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  const step = event.key === 'ArrowDown' ? 1 : -1
                  setActiveIndex((current) => (current + step + options.length) % options.length)
                  return
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault()
                  const chosen = options[activeIndex]
                  if (chosen !== undefined) {
                    pick(chosen)
                  }
                  return
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setDismissedAt(mention?.start ?? null)
                  return
                }
              }
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            className={cn(
              FIELD_TEXT_CLASSES,
              // Transparent text over the copy that carries the colour; the caret keeps its own.
              'absolute inset-0 size-full resize-none bg-transparent text-transparent caret-mri-text outline-none placeholder:text-mri-text2',
            )}
          />
        </div>

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
