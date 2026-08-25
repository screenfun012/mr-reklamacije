import { m } from '@mr/i18n'
import {
  chatMembersOptions,
  deleteChatConversation,
  invalidateChatConversationMetadataQueries,
  removeChatMember,
  type ChatConversationListItem,
} from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { ChannelMembersEditor } from './channel-members-editor'
import { CHAT_PANEL_RESPONSIVE_CLASSES } from './chat-layout'

const EYEBROW_CLASSES = 'font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2'

export interface ChannelPanelProps {
  conversation: ChatConversationListItem
  currentUserId: string
  onDeleted: (conversationId: string) => void
}

/** The open channel's roster, self-leave action and manager-only destructive cleanup. */
export function ChannelPanel({
  conversation,
  currentUserId,
  onDeleted,
}: ChannelPanelProps): React.ReactElement {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const roster = useQuery(chatMembersOptions(conversation.id))
  const members = roster.data?.members ?? []
  const isMember = members.some((person) => person.id === currentUserId)

  const leave = useMutation({
    mutationFn: () => removeChatMember(conversation.id, 'me'),
    onSuccess: () => {
      invalidateChatConversationMetadataQueries(queryClient, conversation.id)
      setLeaving(false)
      void navigate({ to: '/razgovori', search: {} })
    },
    onError: () => {
      setLeaving(false)
      showInternalToast(m.chat_channel_failed())
    },
  })

  const deleteChannel = useMutation({
    mutationFn: () => deleteChatConversation(conversation.id),
    onSuccess: () => {
      setDeleting(false)
      onDeleted(conversation.id)
      showInternalToast(m.chat_erase_done())
    },
    onError: () => showInternalToast(m.chat_channel_failed()),
  })

  return (
    <aside
      aria-label={m.chat_channel_members()}
      className={cn(
        'flex w-[250px] flex-none flex-col overflow-auto border-l border-mri-border bg-mri-surface',
        'animate-in fade-in-0 slide-in-from-bottom-[9px] duration-300 ease-[cubic-bezier(.22,1,.36,1)]',
        CHAT_PANEL_RESPONSIVE_CLASSES,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-mri-border px-[14px] pb-3 pt-[14px]">
        <span className={EYEBROW_CLASSES}>{m.chat_channel_members()}</span>
        <ChannelMembersEditor
          conversationId={conversation.id}
          currentUserId={currentUserId}
          members={members}
          addable={roster.data?.addable ?? []}
          canManage={roster.data?.canManage ?? false}
        />
      </div>

      {isMember || roster.data?.canManage === true ? (
        <div className="mt-auto flex flex-none flex-col border-t border-mri-border">
          {isMember ? (
            <button
              type="button"
              onClick={() => setLeaving(true)}
              className="min-h-10 px-[14px] py-3 text-left text-[11px] font-semibold text-mri-text2 transition-colors hover:text-mri-bad"
            >
              {m.chat_channel_leave()}
            </button>
          ) : null}
          {roster.data?.canManage === true ? (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="min-h-10 px-[14px] py-3 text-left text-[11px] font-semibold text-mri-bad transition-colors hover:bg-mri-rowhv"
            >
              {m.chat_erase()}
            </button>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={m.chat_channel_leave()}
        description={m.chat_channel_leave_confirm({ name: conversation.title })}
        confirmLabel={m.chat_channel_leave()}
        onConfirm={() => leave.mutate()}
      />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={m.chat_erase_title()}
        description={m.chat_erase_description()}
        confirmLabel={m.chat_erase_confirm()}
        variant="destructive"
        pending={deleteChannel.isPending}
        onConfirm={() => deleteChannel.mutate()}
      />
    </aside>
  )
}
