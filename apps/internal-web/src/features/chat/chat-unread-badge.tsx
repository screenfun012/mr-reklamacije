import { chatConversationsOptions } from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'

/**
 * The menu's unread count. It is `unreadTotal` from the conversation list — the ONE number the
 * server already computes with muted conversations left out; a second count computed here would
 * be a second opinion about the same thing.
 *
 * Deliberately not suspense: a slow or failed chat read must never take the whole menu down.
 */
export function ChatUnreadBadge({ className }: { className?: string }): React.ReactElement | null {
  const { data } = useQuery(chatConversationsOptions())
  const total = data?.unreadTotal ?? 0

  if (total === 0) {
    return null
  }

  return (
    <span
      className={cn(
        'ml-auto rounded-[20px] bg-mri-warn-bg px-[7px] py-0.5 font-mono text-[10px] font-semibold tabular-nums text-mri-warn',
        className,
      )}
    >
      {total}
    </span>
  )
}
