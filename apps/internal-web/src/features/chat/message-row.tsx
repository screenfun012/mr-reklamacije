import { m } from '@mr/i18n'
import {
  ChatSystemKind,
  formatChatTime,
  type ChatMessage,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { cn } from '@mr/ui'

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
}

/** One thing somebody said — or, without an author, one thing the shop did. */
export function MessageRow({
  message,
  resolutions,
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
        </span>
        {message.deletedAt === null ? (
          <MessageBody body={message.body} resolutions={resolutions} onOpenClaim={onOpenClaim} />
        ) : (
          <span className="text-[13px] leading-[1.55] italic text-mri-text2">
            {m.chat_message_deleted()}
          </span>
        )}
        {pending ? (
          <span className="font-mono text-[9px] font-medium text-mri-text2">
            {m.chat_message_sending()}
          </span>
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
