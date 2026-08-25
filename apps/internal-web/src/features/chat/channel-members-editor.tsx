import { m } from '@mr/i18n'
import {
  addChatMembers,
  invalidateChatConversationMetadataQueries,
  removeChatMember,
  type ChatPerson,
} from '@mr/shared'
import { ConfirmDialog } from '@mr/ui'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

export interface ChannelMembersEditorProps {
  conversationId: string
  currentUserId: string
  members: readonly ChatPerson[]
  addable: readonly ChatPerson[]
  canManage: boolean
}

/** The one roster control used by both the open-channel panel and the management dialog. */
export function ChannelMembersEditor({
  conversationId,
  currentUserId,
  members,
  addable,
  canManage,
}: ChannelMembersEditorProps): React.ReactElement {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [pendingAddition, setPendingAddition] = useState<ChatPerson | null>(null)

  const refresh = (): void => {
    invalidateChatConversationMetadataQueries(queryClient, conversationId)
  }

  const add = useMutation({
    mutationFn: (userId: string) => addChatMembers(conversationId, [userId]),
    onSuccess: () => {
      setPendingAddition(null)
      setAdding(false)
      refresh()
    },
    onError: () => showInternalToast(m.chat_channel_failed()),
  })

  const remove = useMutation({
    mutationFn: (userId: string) => removeChatMember(conversationId, userId),
    onSuccess: refresh,
    onError: () => showInternalToast(m.chat_channel_failed()),
  })

  return (
    <>
      <ul className="flex flex-col gap-1">
        {members.map((person) => (
          <li key={person.id} className="flex min-h-10 items-center gap-2">
            <span className="grid size-6 flex-none place-items-center rounded-full bg-mri-inbg font-mono text-[9px] font-bold text-mri-text2">
              {person.initials}
            </span>
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-mri-text">
              {person.name}
            </span>
            {canManage && person.id !== currentUserId ? (
              <button
                type="button"
                title={m.chat_channel_remove_member()}
                onClick={() => remove.mutate(person.id)}
                className="grid size-10 flex-none cursor-pointer place-items-center rounded-[7px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-bad"
              >
                <X aria-hidden="true" className="size-3.5" />
                <span className="sr-only">{m.chat_channel_remove_member()}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <>
          <button
            type="button"
            onClick={() => setAdding((open) => !open)}
            aria-expanded={adding}
            className="flex h-10 items-center gap-1.5 rounded-[7px] border border-mri-border2 px-2 text-[11px] font-semibold text-mri-text2 transition-colors hover:border-mri-text2 hover:text-mri-text"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            {m.chat_channel_add_member()}
          </button>

          {adding ? (
            <ul className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto rounded-[7px] border border-mri-border2 p-1">
              {addable.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => setPendingAddition(person)}
                    className="min-h-10 w-full truncate rounded-[5px] px-2 py-1.5 text-left text-[11.5px] text-mri-text transition-colors hover:bg-mri-rowhv"
                  >
                    {person.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={pendingAddition !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAddition(null)
          }
        }}
        title={m.chat_channel_add_member()}
        description={<span className="text-pretty">{m.chat_channel_history_warning()}</span>}
        confirmLabel={m.chat_channel_add_member()}
        variant="default"
        confirmClassName="border-none bg-mri-btn text-mri-btnfg hover:bg-mri-btnhv"
        pending={add.isPending}
        onConfirm={() => {
          if (pendingAddition !== null) {
            add.mutate(pendingAddition.id)
          }
        }}
      />
    </>
  )
}
