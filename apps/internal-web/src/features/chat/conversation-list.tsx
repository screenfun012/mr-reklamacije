import { m } from '@mr/i18n'
import { ChatConversationType, ClaimKind, type ChatConversationListItem } from '@mr/shared'
import { cn } from '@mr/ui'

import { useChatDnd } from './chat-dnd'

/** Per browser, deliberately: it is "not now, here", not a setting that follows a person around. */

/**
 * A muted conversation's unread is not shown and does not count (the server leaves it out of
 * `unreadTotal` too). So it must not float either — a row that jumps to the top carrying no
 * badge is a screen contradicting itself.
 */
function hasVisibleUnread(item: ChatConversationListItem): boolean {
  return item.unreadCount > 0 && !item.isMuted
}

function lastActivity(item: ChatConversationListItem): number {
  return item.lastMessageAt === null ? 0 : Date.parse(item.lastMessageAt)
}

/** Unread first, then whatever was spoken in last. */
export function sortChatConversations(
  items: readonly ChatConversationListItem[],
): ChatConversationListItem[] {
  return [...items].sort((a, b) => {
    const unread = Number(hasVisibleUnread(b)) - Number(hasVisibleUnread(a))
    if (unread !== 0) {
      return unread
    }
    return lastActivity(b) - lastActivity(a)
  })
}

function UnreadBadge({ count }: { count: number }): React.ReactElement {
  return (
    <span className="ml-auto flex-none rounded-[20px] bg-mri-warn-bg px-[7px] py-0.5 font-mono text-[9.5px] font-semibold tabular-nums text-mri-warn">
      {count}
    </span>
  )
}

function MuteBadge(): React.ReactElement {
  return (
    <span className="ml-auto flex-none rounded-[5px] border border-mri-border2 px-1.5 py-0.5 font-mono text-[7.5px] font-bold tracking-[0.1em] text-mri-text2 opacity-70">
      {m.chat_mute_badge()}
    </span>
  )
}

/**
 * A channel: the general one and, later, whatever the office makes. The prototype's fixture had
 * no unread on a channel so it draws none — the badge is the same one its thread rows carry,
 * because a count the sidebar shows and the list hides would read as a bug.
 */
function ChannelRow({
  item,
  active,
  onSelect,
}: {
  item: ChatConversationListItem
  active: boolean
  onSelect: (id: string) => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex h-9 items-center gap-2 rounded-[9px] px-[10px] text-left text-[13px] transition-colors hover:bg-mri-rowhv',
        active
          ? 'bg-[rgba(237,28,36,.11)] font-bold text-mri-text shadow-[inset_2px_0_0_var(--mri-red)]'
          : 'font-semibold text-mri-text2',
        item.isMuted && !active && 'opacity-[.65]',
      )}
    >
      <span aria-hidden="true" className="font-mono text-[12px] font-semibold text-mri-text2">
        #
      </span>
      <span className="truncate">{item.title}</span>
      {item.isMuted ? <MuteBadge /> : null}
      {hasVisibleUnread(item) ? <UnreadBadge count={item.unreadCount} /> : null}
    </button>
  )
}

/** A claim thread: the kind dot, the MR number, and who the claim belongs to. */
function ThreadRow({
  item,
  active,
  onSelect,
}: {
  item: ChatConversationListItem
  active: boolean
  onSelect: (id: string) => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      aria-current={active ? 'true' : undefined}
      className={cn(
        'flex h-10 items-center gap-2 rounded-[9px] px-[10px] text-left transition-colors hover:bg-mri-rowhv',
        active && 'bg-[rgba(237,28,36,.11)] shadow-[inset_2px_0_0_var(--mri-red)]',
        item.isMuted && !active && 'opacity-[.65]',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-[7px] flex-none rounded-full',
          item.claimKind === ClaimKind.Domace ? 'bg-mri-domace' : 'bg-mri-info',
        )}
      />
      <span className="flex min-w-0 flex-col leading-[1.25]">
        <span className="truncate font-mono text-[11.5px] font-semibold text-mri-text">
          {item.title}
        </span>
        <span className="truncate text-[10.5px] text-mri-text2">{item.subtitle}</span>
      </span>
      {item.isMuted ? <MuteBadge /> : null}
      {hasVisibleUnread(item) ? <UnreadBadge count={item.unreadCount} /> : null}
    </button>
  )
}

function SectionHeader({
  label,
  addTitle,
  className,
  onAdd,
}: {
  label: string
  addTitle: string
  className?: string
  /** Absent while the dialog behind it does not exist yet — the button then says so. */
  onAdd?: (() => void) | undefined
}): React.ReactElement {
  return (
    <div className={cn('flex items-center px-[10px] pb-[5px] pt-0.5', className)}>
      <span className="font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2">
        {label}
      </span>
      <button
        type="button"
        disabled={onAdd === undefined}
        onClick={onAdd}
        title={addTitle}
        className={cn(
          'ml-auto grid size-5 place-items-center rounded-md border border-mri-border2 text-[13px] leading-none text-mri-text2',
          // Inert where the dialog behind it does not exist yet — and saying so in its tooltip
          // rather than swallowing a click.
          onAdd === undefined
            ? 'opacity-60'
            : 'transition-colors hover:border-mri-text2 hover:text-mri-text',
        )}
      >
        +
      </button>
    </div>
  )
}

export interface ConversationListProps {
  items: readonly ChatConversationListItem[]
  activeId: string | null
  onSelect: (id: string) => void
  /** Opens the „Nova nit" dialog. */
  onNewThread: () => void
}

/** The left column: DND, search, the channels, the claim threads, and how a thread comes to be. */
export function ConversationList({
  items,
  activeId,
  onSelect,
  onNewThread,
}: ConversationListProps): React.ReactElement {
  const [dnd, setDnd] = useChatDnd()

  const general = items.filter((item) => item.type === ChatConversationType.General)
  const channels = sortChatConversations(
    items.filter((item) => item.type === ChatConversationType.Channel),
  )
  const threads = sortChatConversations(
    items.filter((item) => item.type === ChatConversationType.Claim),
  )

  return (
    <div className="flex w-[252px] flex-none flex-col border-r border-mri-border bg-mri-surface">
      <div className="flex flex-col gap-[9px] px-3 pb-2.5 pt-3.5">
        <div className="flex items-center">
          <span className="font-mono text-[10px] font-bold tracking-[0.22em] text-mri-red">
            {m.chat_eyebrow()}
          </span>
          <button
            type="button"
            onClick={() => setDnd(!dnd)}
            aria-pressed={dnd}
            title={m.chat_dnd_title()}
            className={cn(
              'ml-auto rounded-[7px] border px-[9px] py-1 font-mono text-[8.5px] font-bold tracking-[0.12em] transition-colors',
              dnd
                ? 'border-[rgba(237,28,36,.5)] bg-[rgba(237,28,36,.13)] text-mri-redh'
                : 'border-mri-border2 text-mri-text2',
            )}
          >
            {m.chat_dnd()}
          </button>
        </div>
        {/* Searching MESSAGES is its own piece of work; a box that filtered conversation names
            would answer a different question than the one it asks. */}
        <input
          type="search"
          disabled
          placeholder={m.chat_search_placeholder()}
          title={m.chat_search_disabled_title()}
          className="h-[34px] rounded-lg border border-mri-border2 bg-mri-inbg px-[11px] text-[12px] font-medium text-mri-text outline-none placeholder:text-mri-text2 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2.5 pt-0.5">
        <SectionHeader label={m.chat_section_channels()} addTitle={m.chat_new_channel_title()} />
        {[...general, ...channels].map((item) => (
          <ChannelRow key={item.id} item={item} active={item.id === activeId} onSelect={onSelect} />
        ))}

        <SectionHeader
          label={m.chat_section_threads()}
          addTitle={m.chat_new_thread_title()}
          className="pt-3"
          onAdd={onNewThread}
        />
        {threads.length === 0 ? (
          <p role="status" className="px-[10px] py-1.5 text-[11px] text-mri-text2">
            {m.chat_threads_empty()}
          </p>
        ) : (
          threads.map((item) => (
            <ThreadRow
              key={item.id}
              item={item}
              active={item.id === activeId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <p className="flex-none border-t border-mri-border px-3 py-[11px] text-[10.5px] italic leading-[1.5] text-mri-text2">
        {m.chat_threads_footer()}
      </p>
    </div>
  )
}
