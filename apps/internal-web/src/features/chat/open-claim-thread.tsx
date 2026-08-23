import { m } from '@mr/i18n'
import {
  chatKeys,
  openChatClaimThread,
  type ChatConversationListItem,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { showInternalToast } from '~/lib/internal-toast'

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

export interface ClaimThreadConfirmProps {
  /** The claim being asked about; `null` keeps the dialog shut. */
  target: MrRegistryExistingClaim | null
  onCancel: () => void
  onOpened: (conversationId: string) => void
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
}: ClaimThreadConfirmProps): React.ReactElement {
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: (claim: MrRegistryExistingClaim) => openChatClaimThread(claim.kind, claim.claimId),
    onSuccess: async (conversation) => {
      // Awaited: the screen picks the open conversation out of this list, so opening the new
      // thread before the list carries it would land back on the general channel.
      await queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
      onOpened(conversation.id)
      showInternalToast(m.chat_thread_created_toast())
    },
  })

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
