import { m } from '@mr/i18n'
import {
  ChatSystemKind,
  formatChatTime,
  type ChatMessage,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { cn } from '@mr/ui'
import { Check, CheckCheck, Reply } from 'lucide-react'

import { OUTCOME_LABELS } from '~/components/outcome-pill'
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
  failed?: boolean
  onRetry?: () => void
  /** Absent where a reply cannot be written — a message on a screen with no composer. */
  onReply?: ((message: ChatMessage) => void) | undefined
  /** Whose messages get the ticks: yours. Empty before the session resolves, so nothing shows. */
  currentUserId?: string | undefined
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
 * The message being answered, above the answer.
 *
 * Read from `cet-prototip.dc.html:112-114`: `padding:7px 10px`, `border-left:2px solid --border2`,
 * `background:--inbg`, `border-radius:0 8px 8px 0`, who in mono 600 9.5px and the line at 11.5px,
 * both `--text2`. It hugs its content (`align-self:flex-start`) rather than filling the row.
 */
function QuotedMessage({
  quote,
}: {
  quote: NonNullable<ChatMessage['quote']>
}): React.ReactElement {
  return (
    <span className="flex flex-col gap-[3px] self-start rounded-[0_8px_8px_0] border-l-2 border-mri-border2 bg-mri-inbg px-[10px] py-[7px]">
      <span className="font-mono text-[9.5px] font-semibold text-mri-text2">
        {quote.authorName}
      </span>
      <span className="text-[11.5px] text-mri-text2">
        {/* A withdrawn message says so here too — its words do not travel anywhere. */}
        {quote.isDeleted ? <em>{m.chat_message_deleted()}</em> : quote.excerpt}
      </span>
    </span>
  )
}

/** One thing somebody said — or, without an author, one thing the shop did. */
export function MessageRow({
  message,
  resolutions,
  onReply,
  currentUserId,
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
          {onReply === undefined || message.deletedAt !== null ? null : (
            <button
              type="button"
              title={m.chat_reply()}
              onClick={() => onReply(message)}
              className="inline-flex cursor-pointer text-mri-text2 opacity-50 transition-opacity hover:text-mri-text hover:opacity-100"
            >
              <Reply aria-hidden="true" className="size-[11px]" />
              <span className="sr-only">{m.chat_reply()}</span>
            </button>
          )}
        </span>
        {message.quote === null ? null : <QuotedMessage quote={message.quote} />}
        {message.deletedAt === null ? (
          <MessageBody
            body={message.body}
            resolutions={resolutions}
            onOpenClaim={onOpenClaim}
            mentions={message.mentions}
          />
        ) : (
          <span className="text-[13px] leading-[1.55] italic text-mri-text2">
            {m.chat_message_deleted()}
          </span>
        )}
        {message.author?.id !== undefined &&
        message.author.id !== null &&
        message.author.id === currentUserId ? (
          <MessageTicks pending={pending} seenByAll={message.seenByAll} />
        ) : null}
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
