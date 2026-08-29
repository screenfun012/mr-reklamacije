import { m } from '@mr/i18n'
import {
  chatClaimThreadOptions,
  chatConversationsOptions,
  chatKeys,
  ClaimOutcome,
  setChatConversationMuted,
  type ChatConversationListItem,
  type ClaimKind,
  type ClaimOutcome as ClaimOutcomeType,
} from '@mr/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Suspense } from 'react'

import { InternalButton } from '~/components/internal-button'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'

import { ConversationPane } from './conversation-pane'
import { findClaimThread, useCreateClaimThread } from './open-claim-thread'

export interface ClaimThreadState {
  /** The claim's thread, or `null` — which is also what it is while the list is still coming. */
  thread: ChatConversationListItem | null
  isPending: boolean
  canCreateThread: boolean
}

/**
 * Pending claims use the active conversation list the sidebar already reads. Closed claims are
 * absent from that list by design, so their historical thread comes from the read-only lookup.
 */
export function useClaimThread(
  kind: ClaimKind,
  claimId: string,
  outcome: ClaimOutcomeType,
): ClaimThreadState {
  const isOpen = outcome === ClaimOutcome.Pending
  const conversations = useQuery({ ...chatConversationsOptions(), enabled: isOpen })
  const lookup = useQuery({ ...chatClaimThreadOptions(kind, claimId), enabled: !isOpen })

  if (!isOpen) {
    return {
      thread: lookup.data?.conversation ?? null,
      isPending: lookup.isPending,
      canCreateThread: lookup.data?.canCreateThread ?? false,
    }
  }

  const thread =
    conversations.data === undefined ? null : findClaimThread(conversations.data.items, claimId)

  return {
    thread,
    isPending: conversations.isPending,
    canCreateThread: conversations.data !== undefined && thread === null,
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
  outcome,
}: {
  kind: ClaimKind
  claimId: string
  outcome: ClaimOutcomeType
}): React.ReactElement {
  const { thread, isPending, canCreateThread } = useClaimThread(kind, claimId, outcome)
  const { userId, userName, isAdmin } = useInternalAuthUser()
  const queryClient = useQueryClient()
  // The same write the other doors use (the composer MR offer and the „Nova nit" dialog): the
  // endpoint is get-or-create, so two people pressing at once land in the same room.
  const create = useCreateClaimThread({ onOpened: () => undefined, onClosed: () => undefined })
  const mute = useMutation({
    mutationFn: ({ conversationId, muted }: { conversationId: string; muted: boolean }) =>
      setChatConversationMuted(conversationId, muted),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: chatKeys.claimThread(kind, claimId), exact: true }),
  })

  if (isPending) {
    return (
      <div className={FRAME_CLASSES}>
        <PaneSkeleton />
      </div>
    )
  }

  if (thread === null) {
    if (!canCreateThread) {
      return (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-mri-border bg-mri-surface px-6 py-8">
          <p className="text-balance text-[15px] font-bold text-mri-text">
            {m.chat_thread_closed_empty_title()}
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-mri-border bg-mri-surface px-6 py-8">
        <p className="text-balance text-[15px] font-bold text-mri-text">
          {m.chat_thread_create_title()}
        </p>
        <p className="max-w-[560px] text-pretty text-[12.5px] leading-[1.5] text-mri-text2">
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
      {thread.isLocked ? (
        <div className="flex flex-none justify-end border-b border-mri-border bg-mri-surface p-2">
          <InternalButton
            type="button"
            variant="outline"
            className="h-10 w-auto px-3 text-[10px] active:scale-[0.96]"
            aria-pressed={thread.isMuted}
            disabled={mute.isPending}
            onClick={() => mute.mutate({ conversationId: thread.id, muted: !thread.isMuted })}
          >
            {thread.isMuted ? m.chat_thread_unmute() : m.chat_thread_mute()}
          </InternalButton>
        </div>
      ) : null}
      <Suspense key={thread.id} fallback={<PaneSkeleton />}>
        <ConversationPane
          conversationId={thread.id}
          unreadCount={thread.unreadCount}
          authorName={userName}
          authorId={userId}
          isAdmin={isAdmin}
          isLocked={thread.isLocked}
          isThread
        />
      </Suspense>
    </div>
  )
}
