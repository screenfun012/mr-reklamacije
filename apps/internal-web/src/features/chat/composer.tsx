import { m } from '@mr/i18n'
import {
  ALLOWED_CHAT_ATTACHMENT_MIME_TYPES,
  CHAT_MAX_FILES_PER_MESSAGE,
  isAllowedChatAttachmentMimeType,
  MAX_ATTACHMENT_IMAGE_WIDTH,
  MAX_FILE_SIZE_MB,
} from '@mr/shared'
import {
  chatPeopleOptions,
  CHAT_MESSAGE_MAX_LENGTH,
  MENTION_EVERYONE_ID,
  type ChatMessage,
  type ChatPerson,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { cn, compressImage } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { Camera, Paperclip, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { ComposerAttachments, type PickedFile } from './composer-attachments'
import { ComposerMrSuggestion } from './composer-mr-suggestion'
import {
  EMPTY_DRAFT,
  insertMention,
  reanchorMentions,
  toWireBody,
  type Draft,
} from './composer-mentions'
import { findMentionQuery, MentionMenu, mentionOptions } from './mention-menu'

import { showInternalToast } from '~/lib/internal-toast'
import { useFilePicker } from '~/lib/use-file-picker'

/** The four the prototype offers. Whole sentences of this shop's day, not a phrasebook. */
const QUICK_REPLIES = [
  m.chat_quick_engine_arrived,
  m.chat_quick_report_done,
  m.chat_quick_on_my_way,
  m.chat_quick_picked_up,
] as const

/** 36×40 with a 15px glyph — the prototype's composer button (`cet-prototip.dc.html` L150). */
const ACTION_BUTTON_CLASSES =
  'relative grid h-10 w-9 flex-none cursor-pointer place-items-center rounded-[9px] border border-mri-border2 text-mri-text2 transition-colors after:absolute after:-inset-x-0.5 after:inset-y-0 hover:border-mri-text2 hover:text-mri-text'

export interface ComposerProps {
  isThread: boolean
  onSend: (body: string, files: readonly File[]) => void
  /** The conversation being written in — so the offer never points at the room you are in. */
  conversationId?: string | undefined
  /**
   * Where the offer above the field lands. Absent where there is nowhere to go, and then no offer
   * is made — the same rule the MR chip in a message follows.
   */
  onOpened?: ((conversationId: string) => void) | undefined
  onClosed?: ((claim: MrRegistryExistingClaim) => void) | undefined
  /** The message being answered, so the person can see what they are answering. */
  replyTo?: ChatMessage | null | undefined
  onCancelReply?: (() => void) | undefined
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
  onClosed,
  replyTo,
  onCancelReply,
}: ComposerProps): React.ReactElement {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const text = draft.text
  const [caret, setCaret] = useState(0)
  const [files, setFiles] = useState<readonly PickedFile[]>([])
  // ⚠ The gallery takes photos AND PDF; the camera always takes `image/*`, because `capture`
  // opens the camera app and there is no version of that which hands back a document.
  const picker = useFilePicker((picked) => addFiles(picked), {
    accept: ALLOWED_CHAT_ATTACHMENT_MIME_TYPES.join(','),
  })
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

  const addFiles = (picked: readonly File[]): void => {
    const room = CHAT_MAX_FILES_PER_MESSAGE - files.length
    if (room <= 0) {
      showInternalToast(m.chat_attachment_too_many())
      return
    }

    const rightType = picked.filter((file) => isAllowedChatAttachmentMimeType(file.type))
    if (rightType.length < picked.length) {
      // The `accept` attribute is a hint a person can walk past in the file dialog; the server
      // refuses the rest anyway, and saying so here costs nothing and a round trip less.
      // ⚠ The SHARED list, not `startsWith('image/')`: a GIF passes that and the server refuses it.
      showInternalToast(m.chat_attachment_bad_type())
    }

    /*
     * ⚠ And the size, before a single byte leaves the tablet.
     *
     * The pipeline refuses anything over MAX_FILE_SIZE_MB, but only after it has arrived — a 30 MB
     * photo would climb the hall wifi in full to be thrown away at the other end, and the person
     * would see nothing but "not sent".
     */
    const allowed = rightType.filter((file) => file.size <= MAX_FILE_SIZE_MB * 1024 * 1024)
    if (allowed.length < rightType.length) {
      showInternalToast(m.chat_attachment_too_big({ mb: MAX_FILE_SIZE_MB }))
    }
    if (allowed.length > room) {
      showInternalToast(m.chat_attachment_too_many())
    }

    /*
     * ⚠ Shrunk HERE, in the browser, before a byte leaves the device.
     *
     * Measured on this route: five 8 MB phone photos take the API from 42 MB to 299 MB of RSS, and
     * it is one process carrying claims, intake and the portal. Shrinking first turns the ordinary
     * case into about 15 MB. The intake wizard has done this since it was built
     * (`use-intake-photo-queue.ts:139`); the chat simply never got it.
     *
     * ⚠ `compressImage` hands back the ORIGINAL when it cannot decode — HEIC straight off an iPad
     * is the real case — so the server stays the one that enforces the size, and this is only ever
     * an improvement, never a guarantee.
     */
    const queued = allowed.slice(0, room).map((file) => ({ id: crypto.randomUUID(), file }))
    setFiles((current) => [...current, ...queued])

    for (const entry of queued) {
      if (!entry.file.type.startsWith('image/')) {
        continue
      }
      void compressImage(entry.file, { maxEdge: MAX_ATTACHMENT_IMAGE_WIDTH }).then((smaller) => {
        if (smaller === entry.file) {
          return
        }
        // Replaced in place: the tile the person is looking at keeps its identity and its position.
        setFiles((current) =>
          current.map((picked) => (picked.id === entry.id ? { ...picked, file: smaller } : picked)),
        )
      })
    }
  }

  const submit = (): void => {
    // A photo on its own IS a message (Nikola, 2026-08-24) — so words are only required when
    // nothing else came with them.
    if (draft.text.trim() === '' && files.length === 0) {
      return
    }
    // The words are what a person wrote; the addresses are what the server is given.
    onSend(
      toWireBody(draft).trim(),
      files.map((picked) => picked.file),
    )
    setDraft(EMPTY_DRAFT)
    setFiles([])
  }

  return (
    <div className="flex flex-none flex-col border-t border-mri-border bg-mri-surface">
      {onOpened === undefined || onClosed === undefined ? null : (
        <ComposerMrSuggestion
          draft={text}
          conversationId={conversationId}
          onOpened={onOpened}
          onClosed={onClosed}
        />
      )}
      <ComposerAttachments
        files={files}
        onRemove={(id) => setFiles((current) => current.filter((picked) => picked.id !== id))}
      />
      {replyTo === null || replyTo === undefined ? null : (
        <div className="flex items-center gap-2 border-b border-mri-border bg-mri-inbg px-4 py-2">
          <span className="font-mono text-[8px] font-semibold tracking-[0.16em] text-mri-text2">
            {m.chat_reply_to()}
          </span>
          <span className="font-mono text-[9.5px] font-semibold text-mri-text2">
            {replyTo.author?.name ?? ''}
          </span>
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-mri-text2">
            {replyTo.body}
          </span>
          <button
            type="button"
            title={m.chat_reply_cancel()}
            onClick={() => onCancelReply?.()}
            className="grid size-5 flex-none cursor-pointer place-items-center rounded text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-text"
          >
            <X aria-hidden="true" className="size-3" />
            <span className="sr-only">{m.chat_reply_cancel()}</span>
          </button>
        </div>
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
            className="relative rounded-[20px] border border-mri-border2 px-[11px] py-[5px] text-[11px] font-semibold text-mri-text2 transition-colors after:absolute after:inset-x-0 after:-inset-y-2 hover:border-mri-text2 hover:text-mri-text"
          >
            {quick()}
          </button>
        ))}
      </div>

      <div className="relative flex items-end gap-[9px] px-4 pt-2.5 pb-3">
        {menuOpen ? (
          <MentionMenu options={options} activeIndex={activeIndex} onPick={pick} />
        ) : null}
        {picker.inputs}
        <button
          type="button"
          title={m.chat_attach_title()}
          onClick={picker.openGallery}
          className={ACTION_BUTTON_CLASSES}
        >
          <Paperclip aria-hidden="true" className="size-[15px]" />
          <span className="sr-only">{m.chat_attach()}</span>
        </button>
        {/*
          Only where there is a camera to open. On a laptop `capture` falls back to the same file
          dialog the paperclip opens, so the button would promise a camera that is not there.
          Plain CSS, so the server and the browser draw the same thing.
        */}
        <button
          type="button"
          title={m.chat_camera_title()}
          onClick={picker.openCamera}
          className={`${ACTION_BUTTON_CLASSES} hidden [@media(pointer:coarse)]:grid`}
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
            onPaste={(event) => {
              /*
               * A screenshot in the clipboard is the fastest thing anybody sends.
               *
               * ⚠ But only when the clipboard carries NOTHING BUT files. Copying a cell out of
               * Excel, or a line out of Outlook, puts an `image/png` bitmap on the clipboard
               * ALONGSIDE the text — and this office lives in Excel. Taking over on
               * `files.length > 0` alone attached a picture of the cell and threw the MR number
               * away.
               */
              const pasted = [...event.clipboardData.files]
              if (pasted.length > 0 && event.clipboardData.getData('text/plain') === '') {
                event.preventDefault()
                addFiles(pasted)
              }
            }}
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
                  // ⚠ And stops here: the frame above closes its sheets on Escape, and shutting a
                  // mention menu is not a request to close the room's panel as well.
                  event.stopPropagation()
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
          disabled={text.trim() === '' && files.length === 0}
          className="h-10 flex-none rounded-[9px] bg-mri-btn px-[18px] text-[11px] font-bold tracking-[0.06em] whitespace-nowrap text-mri-btnfg shadow-[0_8px_22px_rgba(0,0,0,.4)] transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {m.chat_composer_send()}
        </button>
      </div>
    </div>
  )
}
