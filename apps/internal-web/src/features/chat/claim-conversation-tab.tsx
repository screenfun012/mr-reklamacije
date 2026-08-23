import { m } from '@mr/i18n'
import { chatConversationsOptions, type ChatConversationListItem, type ClaimKind } from '@mr/shared'
import { useQuery } from '@tanstack/react-query'
import { Suspense } from 'react'

import { InternalButton } from '~/components/internal-button'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'

import { ConversationPane } from './conversation-pane'
import { findClaimThread, useCreateClaimThread } from './open-claim-thread'

export interface ClaimThreadState {
  /** The claim's thread, or `null` — which is also what it is while the list is still coming. */
  thread: ChatConversationListItem | null
  isPending: boolean
}

/**
 * The claim's thread, out of the conversation list the sidebar already reads.
 *
 * Deliberately that list and not a lookup of its own: it is in the cache on every internal
 * screen, it carries the unread number the tab shows, and a second endpoint answering "does
 * this claim have a thread" would be a second opinion about the same row.
 */
export function useClaimThread(claimId: string): ClaimThreadState {
  const { data, isPending } = useQuery(chatConversationsOptions())

  return {
    thread: data === undefined ? null : findClaimThread(data.items, claimId),
    isPending,
  }
}

/** The chat frame, on a tab: it scrolls inside itself so the claim's page never grows a mile. */
const FRAME_CLASSES =
  'flex h-[600px] flex-col overflow-hidden rounded-xl border border-mri-border bg-mri-bg'

function PaneSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-3.5 p-4" aria-hidden="true">
      <div className="h-10 w-2/3 animate-pulse rounded-lg bg-mri-inbg" />
      <div className="h-10 w-1/2 animate-pulse rounded-lg bg-mri-inbg" />
      <div className="h-10 w-3/5 animate-pulse rounded-lg bg-mri-inbg" />
    </div>
  )
}

/**
 * The claim's own conversation, on its own tab (spec §5 row 15, §8.5).
 *
 * The same thread and the same composer the „Razgovori" screen mounts — and NO context panel:
 * the claim's detail is already the context, so the third column would only repeat the screen
 * it is standing on.
 *
 * ⚠ Opening this tab must create NOTHING. A claim without a thread gets an offer with a button;
 * the write happens when a person presses it, never because a tab was looked at.
 */
export function ClaimConversationTab({
  kind,
  claimId,
}: {
  kind: ClaimKind
  claimId: string
}): React.ReactElement {
  const { thread, isPending } = useClaimThread(claimId)
  const { userId, userName } = useInternalAuthUser()
  // The same write both other doors use (the MR chip in a message, the „Nova nit" dialog): the
  // endpoint is get-or-create, so two people pressing at once land in the same room.
  const create = useCreateClaimThread(() => undefined)

  if (isPending) {
    return (
      <div className={FRAME_CLASSES}>
        <PaneSkeleton />
      </div>
    )
  }

  if (thread === null) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-mri-border bg-mri-surface px-6 py-8">
        <p className="text-[15px] font-bold text-mri-text">{m.chat_thread_create_title()}</p>
        <p className="max-w-[560px] text-[12.5px] leading-[1.5] text-mri-text2">
          {m.chat_thread_create_description()}
        </p>
        <InternalButton
          type="button"
          variant="outline"
          className="h-9 w-auto px-4 text-[11px]"
          disabled={create.isPending}
          onClick={() => create.mutate({ kind, claimId })}
        >
          {m.chat_thread_create_confirm()}
        </InternalButton>
      </div>
    )
  }

  return (
    <div className={FRAME_CLASSES}>
      <Suspense key={thread.id} fallback={<PaneSkeleton />}>
        <ConversationPane
          conversationId={thread.id}
          unreadCount={thread.unreadCount}
          authorName={userName}
          authorId={userId}
          isThread
        />
      </Suspense>
    </div>
  )
}
