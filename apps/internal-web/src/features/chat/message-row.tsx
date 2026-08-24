import { m } from '@mr/i18n'
import {
  ChatSystemKind,
  formatChatTime,
  type ChatMessage,
  type ChatReactor,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { Check, CheckCheck, CornerUpLeft, Pin, PinOff, Reply, ThumbsUp } from 'lucide-react'

import { OUTCOME_LABELS } from '~/components/outcome-pill'
import { AttachmentOnlyExcerpt, MessageAttachments } from './message-attachments'
import { PendingAttachments } from './composer-attachments'
import { MessageBody } from './message-body'

/**
 * The four the prototype's own avatar map carries. Which person gets which is the one thing that
 * map does NOT define — it was hand-picked per fixture — so the hue is derived from the author's
 * id: the same person keeps the same colour in every conversation, forever, without a column.
 */
const AVATAR_TONES = [
  'bg-mri-red text-white',
  'bg-[rgba(46,144,250,.18)] text-mri-info',
  'bg-[rgba(167,139,250,.18)] text-mri-domace',
  'bg-[rgba(31,169,113,.18)] text-mri-grn',
] as const

function avatarTone(key: string): string {
  let sum = 0
  for (let index = 0; index < key.length; index += 1) {
    sum += key.charCodeAt(index)
  }
  return AVATAR_TONES[sum % AVATAR_TONES.length] ?? AVATAR_TONES[0]
}

/** "Marko Petrović" → "MP". Two letters, because the circle is 32px and holds no more. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
  return letters === '' ? '?' : letters
}

function outcomeLabel(value: string | undefined): string {
  if (value === undefined) {
    return ''
  }
  const label = (OUTCOME_LABELS as Record<string, (() => string) | undefined>)[value]
  return label === undefined ? value : label()
}

/**
 * The sentence is drawn HERE, from `system_kind` + `system_meta` — the row carries no body on
 * purpose, so a rename or a second language does not have to rewrite history.
 */
const SYSTEM_SENTENCE: Record<ChatSystemKind, (meta: Record<string, string>) => string> = {
  [ChatSystemKind.ThreadCreated]: () => m.chat_system_thread_created(),
  [ChatSystemKind.OutcomeChanged]: (meta) =>
    m.chat_system_outcome_changed({ outcome: outcomeLabel(meta['outcome']) }),
  [ChatSystemKind.AttachmentAdded]: () => m.chat_system_attachment_added(),
  [ChatSystemKind.PublishedToClient]: () => m.chat_system_published_to_client(),
  [ChatSystemKind.CategoryChanged]: (meta) =>
    m.chat_system_category_changed({ from: meta['from'] ?? '', to: meta['to'] ?? '' }),
  [ChatSystemKind.ChannelCreated]: () => m.chat_system_channel_created(),
}

function SystemMessage({ message }: { message: ChatMessage }): React.ReactElement {
  const sentence = message.systemKind === null ? undefined : SYSTEM_SENTENCE[message.systemKind]

  return (
    <div className="flex justify-center">
      <span
        role="status"
        className="inline-flex items-center gap-2 rounded-[20px] border border-mri-border bg-mri-inbg px-3 py-1.5 text-center font-mono text-[10.5px] font-medium text-mri-text2"
      >
        <span aria-hidden="true" className="text-mri-warn">
          ↻
        </span>
        {sentence === undefined ? '' : sentence(message.systemMeta ?? {})}
        <span className="opacity-60">· {formatChatTime(message.createdAt)}</span>
      </span>
    </div>
  )
}

export interface MessageRowProps {
  message: ChatMessage
  /** Resolved for the whole list at once — see `use-mr-resolutions`. */
  resolutions: ReadonlyMap<string, MrRegistryExistingClaim>
  onOpenClaim?: ((target: MrRegistryExistingClaim) => void) | undefined
  /** Written here, not yet answered for by the server. */
  pending?: boolean
  /**
   * The files this row is still carrying up, as the browser's own `File` objects.
   *
   * ⚠ Without them a photo-with-no-caption is an EMPTY bubble for as long as the upload takes —
   * the server's `attachments` cannot be filled in yet, because none of these has an id.
   */
  pendingFiles?: readonly File[] | undefined
  failed?: boolean
  onRetry?: () => void
  /** Absent where a reply cannot be written — a message on a screen with no composer. */
  onReply?: ((message: ChatMessage) => void) | undefined
  /** Toggles your own tick. Absent where the screen has nothing to send it with. */
  onReact?: ((message: ChatMessage) => void) | undefined
  /** Toggles this message on the room's shortlist. */
  onPin?: ((message: ChatMessage) => void) | undefined
  /** Whether this message is on that shortlist right now — read from the pins, not the message. */
  isPinned?: boolean
  /** Whether taking it down is this person's to do: they put it there, or they are an admin. */
  canUnpin?: boolean
  /** Whose messages get the ticks: yours. Empty before the session resolves, so nothing shows. */
  currentUserId?: string | undefined
  /** Opens a photo full size. Absent where there is no viewer to open — then a tile just sits. */
  onOpenImage?: ((message: ChatMessage, attachmentId: string) => void) | undefined
}

/**
 * One tick while it is going, two when it is stored, two coloured when everybody who can see the
 * room has got that far — WhatsApp's idiom, which is what Nikola asked for over the prototype's
 * „VIĐENO: SJ, DI" list (2026-08-23).
 *
 * ⚠ Only on your OWN messages, like WhatsApp: ticks under somebody else's line answer a question
 * nobody asked and invite the one nobody wants ("you saw it and did not reply").
 *
 * ⚠ In a nine-person channel the coloured pair will rarely light — one man on the road is enough
 * to hold it. In a claim thread with two or three people it does its job. That is the same
 * behaviour group chats have everywhere, not a defect.
 */
function MessageTicks({
  pending,
  seenByAll,
}: {
  pending: boolean
  seenByAll: boolean
}): React.ReactElement {
  if (pending) {
    return (
      <span title={m.chat_message_sending()} className="text-mri-text2">
        <Check aria-hidden="true" className="size-[13px]" />
        <span className="sr-only">{m.chat_message_sending()}</span>
      </span>
    )
  }

  const label = seenByAll ? m.chat_ticks_seen_by_all() : m.chat_ticks_sent()
  return (
    <span title={label} className={seenByAll ? 'text-mri-info' : 'text-mri-text2'}>
      <CheckCheck aria-hidden="true" className="size-[13px]" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

/**
 * Who liked it — the names, not a number.
 *
 * Nikola, 2026-08-24: „da lajkujemo poruku pa kada se pojavi ono zeleno ispod da vidimo ko je sve
 * lajkovao". So the chip prints them. In a shop of nine people a message collects two or three
 * likes, which fits on the line; past `NAMED_REACTORS` it says how many more rather than wrapping
 * a paragraph of names under a one-line message.
 *
 * The prototype's own values are kept (`cet-prototip.dc.html:132`): mono `600 10px`, `--grn` on
 * `rgba(31,169,113,.12)` over a `rgba(31,169,113,.35)` border, `padding:3px 8px`, radius 20.
 * Drawn only once somebody has liked it — a chip under every line reading zero is noise.
 */
const NAMED_REACTORS = 3

export function reactionLabel(people: readonly { name: string }[]): string {
  const named = people.slice(0, NAMED_REACTORS).map((person) => person.name)
  const rest = people.length - named.length
  return rest > 0
    ? `${named.join(', ')} ${m.chat_reactions_more({ count: rest })}`
    : named.join(', ')
}

function ReactionChip({
  people,
  mine,
  onToggle,
}: {
  people: readonly ChatReactor[]
  mine: boolean
  onToggle: (() => void) | undefined
}): React.ReactElement | null {
  if (people.length === 0) {
    return null
  }

  return (
    <button
      type="button"
      disabled={onToggle === undefined}
      aria-pressed={mine}
      // Everybody, however many are printed — the hover says what the line had to leave out.
      title={people.map((person) => person.name).join(', ')}
      onClick={onToggle}
      className={cn(
        'inline-flex w-fit max-w-full items-center gap-[5px] rounded-[20px] border px-2 py-[3px] font-mono text-[10px] transition-colors',
        'border-[rgba(31,169,113,.35)] bg-[rgba(31,169,113,.12)] text-mri-grn',
        onToggle === undefined ? 'cursor-default' : 'cursor-pointer hover:border-mri-grn',
        mine ? 'font-bold' : 'font-medium',
      )}
    >
      <ThumbsUp aria-hidden="true" className="size-[11px] flex-none" />
      <span className="truncate">{reactionLabel(people)}</span>
    </button>
  )
}

/**
 * The message being answered, above the answer.
 *
 * Read from `cet-prototip.dc.html:112-114`: `padding:7px 10px`, `background:--inbg`,
 * `border-radius:0 8px 8px 0`, hugging its content rather than filling the row.
 *
 * ⚠ Several values are deliberately NOT the prototype's. It drew the rule in `--border2` and both
 * lines in `--text2`, and Nikola, 2026-08-24: „previše je monohrom, stapa se u pozadinu". He is
 * right — a grey rule against a grey block on a grey surface has nothing to see. The accent is the
 * softer red (the one hue the message stream does not already spend on something else — blue is
 * an MR number, green is a like), it carries the little reply arrow and the name, and the quoted
 * words come up to `--text` so they can actually be read.
 *
 * Then „sredi ovaj reply, tu je sve samo malo lepše": a hairline closes the other three sides so
 * the block is a card instead of a stripe running off into the background, the corners follow the
 * rule (tight at the accent, round away from it), and the quote is clamped to two lines — a long
 * message being answered used to tower over the one-line answer under it.
 */
function QuotedMessage({
  quote,
}: {
  quote: NonNullable<ChatMessage['quote']>
}): React.ReactElement {
  return (
    <span className="flex max-w-[520px] flex-col gap-[3px] self-start rounded-[3px_10px_10px_3px] border border-l-2 border-mri-border border-l-mri-redh bg-mri-inbg py-[7px] pl-[11px] pr-3">
      <span className="flex items-center gap-1.5 font-mono text-[9.5px] font-semibold text-mri-redh">
        <CornerUpLeft aria-hidden="true" className="size-[10px]" />
        {quote.authorName}
      </span>
      <span className="line-clamp-2 text-[11.5px] leading-[1.45] text-mri-text">
        {/* A withdrawn message says so here too — its words do not travel anywhere. */}
        {quote.isDeleted ? (
          <em>{m.chat_message_deleted()}</em>
        ) : quote.excerpt === '' && quote.hasAttachment ? (
          <AttachmentOnlyExcerpt />
        ) : (
          quote.excerpt
        )}
      </span>
    </span>
  )
}

/**
 * One action beside the author's name.
 *
 * Two sizes at once, and that is the whole trick. Nikola asked twice, 2026-08-24: first „previše
 * su mali, jedva ih pritisnem" (they were an 11px glyph with no padding — the glyph WAS the
 * target), then „nisam mislio na ovaj nacin, uzasno izgleda" about the 28px boxes that answered
 * it. He is right both times: what has to be big is the area a thumb lands on, and what has to
 * stay small is the mark on the screen.
 *
 * So the glyph is 15px and the padding around it is invisible — `p-[7px]` pulled back out with an
 * equal negative margin, so the button occupies 29×29 for a finger and nothing at all for the
 * layout. No box, no border, no hover fill: colour is the only thing that moves.
 */
function ActionGlyph({
  label,
  onClick,
  pressed,
  tone,
  children,
}: {
  label: string
  onClick: () => void
  pressed?: boolean
  /** What the glyph turns once it is on — the same colour its result wears elsewhere. */
  tone?: string
  children: React.ReactNode
}): React.ReactElement {
  return (
    <button
      type="button"
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex flex-none cursor-pointer p-[7px] transition-colors',
        '-my-[7px] -mr-[3px] -ml-[4px]',
        pressed === true ? (tone ?? 'text-mri-text') : 'text-mri-text2 hover:text-mri-text',
      )}
    >
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

/** One thing somebody said — or, without an author, one thing the shop did. */
export function MessageRow({
  message,
  resolutions,
  onReply,
  onReact,
  onPin,
  isPinned = false,
  canUnpin = true,
  currentUserId,
  onOpenImage,
  pendingFiles,
  onOpenClaim,
  pending = false,
  failed = false,
  onRetry,
}: MessageRowProps): React.ReactElement {
  if (message.systemKind !== null) {
    return <SystemMessage message={message} />
  }

  const name = message.author?.name ?? ''
  const initials = message.author?.initials ?? initialsOf(name)
  // Derived, not a second field on the wire: the list of who liked it is the whole truth.
  const likedByMe =
    currentUserId !== undefined && message.reactedBy.some((person) => person.id === currentUserId)

  return (
    <article
      aria-busy={pending ? 'true' : undefined}
      className={cn('flex gap-2.5', pending && 'opacity-60')}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-8 flex-none place-items-center rounded-full text-[11px] font-extrabold',
          avatarTone(message.author?.id ?? name),
        )}
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-col gap-[5px]">
        <span className="flex items-center gap-2">
          <span className="text-[13px] font-extrabold text-mri-text">{name}</span>
          <span className="font-mono text-[9.5px] font-medium text-mri-text2">
            {formatChatTime(message.createdAt)}
          </span>
          {message.editedAt === null ? null : (
            <span className="font-mono text-[9px] font-medium italic text-mri-text2">
              {m.chat_message_edited()}
            </span>
          )}
          {message.deletedAt !== null ? null : (
            <>
              {/* The prototype gives a message no actions of its own but the copy-link glyph
                  (L111). Reply landed here first and set the idiom — an 11px glyph at half
                  opacity — so the tick and the pin join it rather than inventing a hover bar. */}
              {onReact === undefined ? null : (
                <ActionGlyph
                  label={likedByMe ? m.chat_unreact() : m.chat_react()}
                  pressed={likedByMe}
                  tone="text-mri-grn"
                  onClick={() => onReact(message)}
                >
                  <ThumbsUp aria-hidden="true" className="size-[15px]" />
                </ActionGlyph>
              )}
              {onReply === undefined ? null : (
                <ActionGlyph label={m.chat_reply()} onClick={() => onReply(message)}>
                  <Reply aria-hidden="true" className="size-[15px]" />
                </ActionGlyph>
              )}
              {/* Taking a pin down belongs to whoever put it up, or to an admin — the same rule
                  the server enforces. Offering a ✕ that answers 403 is worse than not offering it. */}
              {onPin === undefined || (isPinned && !canUnpin) ? null : (
                <ActionGlyph
                  label={isPinned ? m.chat_unpin() : m.chat_pin()}
                  pressed={isPinned}
                  tone="text-mri-red"
                  onClick={() => onPin(message)}
                >
                  {isPinned ? (
                    <PinOff aria-hidden="true" className="size-[15px]" />
                  ) : (
                    <Pin aria-hidden="true" className="size-[15px]" />
                  )}
                </ActionGlyph>
              )}
            </>
          )}
        </span>
        {message.quote === null ? null : <QuotedMessage quote={message.quote} />}
        {message.deletedAt === null ? (
          <>
            <MessageBody
              body={message.body}
              resolutions={resolutions}
              onOpenClaim={onOpenClaim}
              mentions={message.mentions}
            />
            {/* Prototype order (L110-135): name → quote → text → images → document → footer.
                Inside the withdrawn branch on purpose: taking a message back takes its files with
                it, and the server already empties `attachments` — this is the second half of the
                same promise, so the two cannot drift. */}
            <MessageAttachments
              conversationId={message.conversationId}
              attachments={message.attachments}
              onOpenImage={(attachmentId) => onOpenImage?.(message, attachmentId)}
            />
            <PendingAttachments files={pendingFiles ?? []} />
          </>
        ) : (
          <span className="text-[13px] leading-[1.55] italic text-mri-text2">
            {m.chat_message_deleted()}
          </span>
        )}
        {/* L132: the tick chip and „viđeno" share one footer row. Ours carries the ticks instead
            of the prototype's initials list — Nikola's call, 2026-08-23. */}
        <span className="flex items-center gap-2">
          <ReactionChip
            people={message.reactedBy}
            mine={likedByMe}
            onToggle={onReact === undefined ? undefined : () => onReact(message)}
          />
          {message.author?.id !== undefined &&
          message.author.id !== null &&
          message.author.id === currentUserId ? (
            <MessageTicks pending={pending} seenByAll={message.seenByAll} />
          ) : null}
        </span>
        {failed ? (
          <span className="flex items-center gap-2 font-mono text-[9px] font-medium text-mri-bad">
            {m.chat_message_failed()}
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md border border-mri-border2 px-2 py-0.5 font-mono text-[9px] font-bold text-mri-text2 transition-colors hover:text-mri-text"
            >
              {m.chat_message_retry()}
            </button>
          </span>
        ) : null}
      </span>
    </article>
  )
}
