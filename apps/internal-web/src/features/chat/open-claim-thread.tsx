import { m } from '@mr/i18n'
import {
  ApiError,
  chatClaimThreadOptions,
  chatConversationsOptions,
  chatKeys,
  openChatClaimThread,
  type ChatConversationListItem,
  type ChatClaimThreadLookup,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'

import { showInternalToast } from '~/lib/internal-toast'

export function useResolveClaimThread({
  onActive,
  onMissing,
  onClosed,
}: {
  onActive: (conversationId: string) => void
  onMissing: (claim: MrRegistryExistingClaim) => void
  onClosed: (claim: MrRegistryExistingClaim) => void
}): UseMutationResult<ChatClaimThreadLookup, Error, MrRegistryExistingClaim> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (claim) =>
      queryClient.fetchQuery({
        ...chatClaimThreadOptions(claim.kind, claim.claimId),
        staleTime: 0,
      }),
    onSuccess: (lookup, claim) => {
      if (lookup.conversation?.isLocked === true) {
        onClosed(claim)
      } else if (lookup.conversation !== null) {
        onActive(lookup.conversation.id)
      } else if (lookup.canCreateThread) {
        onMissing(claim)
      } else {
        onClosed(claim)
      }
    },
    onError: () => showInternalToast(m.chat_thread_unavailable_toast()),
  })
}

/**
 * The thread a claim already has, or null.
 *
 * This is the whole difference between opening and asking: a claim with a thread is one click,
 * a claim without one is a question. "1 claim = 1 thread" is a database constraint, so the first
 * match is the only match.
 */
export function findClaimThread(
  items: readonly ChatConversationListItem[],
  claimId: string,
): ChatConversationListItem | null {
  return items.find((item) => item.claimId === claimId) ?? null
}

/**
 * Makes a claim's thread and opens what came back — the one write both doors share (the chip in
 * a message, and the „Nova nit" dialog).
 */
export function useCreateClaimThread({
  onOpened,
  onClosed,
}: {
  onOpened: (conversationId: string) => void
  onClosed: (claim: MrRegistryExistingClaim) => void
}): UseMutationResult<ChatConversationListItem, Error, MrRegistryExistingClaim> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (claim: MrRegistryExistingClaim) => openChatClaimThread(claim.kind, claim.claimId),
    onSuccess: async (conversation, claim) => {
      await queryClient.invalidateQueries({
        queryKey: chatKeys.claimThread(claim.kind, claim.claimId),
        exact: true,
        refetchType: 'none',
      })
      const active = await queryClient.fetchQuery({
        ...chatConversationsOptions(),
        staleTime: 0,
      })
      if (active.items.some((item) => item.id === conversation.id)) {
        onOpened(conversation.id)
        showInternalToast(m.chat_thread_opened_toast())
        return
      }

      try {
        const lookup = await queryClient.fetchQuery({
          ...chatClaimThreadOptions(claim.kind, claim.claimId),
          staleTime: 0,
        })
        if (lookup.conversation?.id === conversation.id) {
          onClosed(claim)
          showInternalToast(m.chat_thread_saved_closed_toast())
          return
        }
      } catch {
        // A 404 here means the claim or thread disappeared in the narrow post-create window.
      }
      showInternalToast(m.chat_thread_unavailable_toast())
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 422) {
        showInternalToast(m.chat_thread_closed_create_error())
      }
    },
  })
}

export interface ClaimThreadConfirmProps {
  /** The claim being asked about; `null` keeps the dialog shut. */
  target: MrRegistryExistingClaim | null
  onCancel: () => void
  onOpened: (conversationId: string) => void
  onClosed: (claim: MrRegistryExistingClaim) => void
}

/**
 * "This claim has no thread — make one?"
 *
 * ⚠ Nothing is created until this is confirmed (spec §8.2). The endpoint is get-or-create, so two
 * people confirming at the same second land in the same room; what must not happen is a thread
 * appearing because somebody clicked a number in a sentence.
 */
export function ClaimThreadConfirm({
  target,
  onCancel,
  onOpened,
  onClosed,
}: ClaimThreadConfirmProps): React.ReactElement {
  const create = useCreateClaimThread({ onOpened, onClosed })

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) {
          onCancel()
        }
      }}
      title={m.chat_thread_create_title()}
      description={m.chat_thread_create_description()}
      confirmLabel={m.chat_thread_create_confirm()}
      variant="default"
      confirmClassName="border-none bg-mri-btn text-mri-btnfg hover:bg-mri-btnhv"
      pending={create.isPending}
      onConfirm={() => {
        if (target !== null) {
          create.mutate(target)
        }
      }}
    />
  )
}
