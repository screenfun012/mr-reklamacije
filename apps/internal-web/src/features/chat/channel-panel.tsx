import { m } from '@mr/i18n'
import {
  addChatMembers,
  chatKeys,
  chatMembersOptions,
  removeChatMember,
  type ChatConversationListItem,
} from '@mr/shared'
import { cn, ConfirmDialog } from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { CHAT_PANEL_RESPONSIVE_CLASSES } from './chat-layout'

const EYEBROW_CLASSES = 'font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2'

export interface ChannelPanelProps {
  conversation: ChatConversationListItem
  currentUserId: string
  isAdmin: boolean
}

/**
 * Who is in this channel, and the two things that change it.
 *
 * ⚠ Anybody may walk out — including the person who made it. That is exactly how a channel ends up
 * with nobody in it, which is why an admin can still see an empty one: otherwise the room would be
 * visible to nobody at all and could never be deleted.
 */
export function ChannelPanel({
  conversation,
  currentUserId,
  isAdmin,
}: ChannelPanelProps): React.ReactElement {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const roster = useQuery(chatMembersOptions(conversation.id))
  const members = roster.data?.members ?? []
  const addable = roster.data?.addable ?? []

  const refresh = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: chatKeys.members(conversation.id) }),
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() }),
    ])
  }

  const add = useMutation({
    mutationFn: (userId: string) => addChatMembers(conversation.id, [userId]),
    onSuccess: refresh,
    onError: () => showInternalToast(m.chat_channel_failed()),
  })

  const remove = useMutation({
    mutationFn: (userId: string) => removeChatMember(conversation.id, userId),
    onSuccess: refresh,
    onError: () => showInternalToast(m.chat_channel_failed()),
  })

  const leave = useMutation({
    mutationFn: () => removeChatMember(conversation.id, 'me'),
    onSuccess: async () => {
      await refresh()
      setLeaving(false)
      // The room is not his any more, so the screen must not keep standing in it.
      void navigate({ to: '/razgovori', search: {} })
    },
    onError: () => {
      setLeaving(false)
      showInternalToast(m.chat_channel_failed())
    },
  })

  const isMember = members.some((person) => person.id === currentUserId)

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

        {/* ⚠ Says why an empty room is on screen at all. Without it an admin sees a channel nobody
            is in and has no idea why it is there. */}
        {members.length === 0 && isAdmin ? (
          <p className="text-[11px] leading-[1.45] text-mri-text2">
            {m.chat_channel_empty_notice()}
          </p>
        ) : null}

        <ul className="flex flex-col gap-1">
          {members.map((person) => (
            <li key={person.id} className="flex items-center gap-2">
              <span className="grid size-6 flex-none place-items-center rounded-full bg-mri-inbg font-mono text-[9px] font-bold text-mri-text2">
                {person.initials}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-mri-text">
                {person.name}
              </span>
              <button
                type="button"
                title={m.chat_channel_remove_member()}
                onClick={() => remove.mutate(person.id)}
                className="grid size-5 flex-none cursor-pointer place-items-center rounded-[5px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-bad"
              >
                <X aria-hidden="true" className="size-3" />
                <span className="sr-only">{m.chat_channel_remove_member()}</span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setAdding((open) => !open)}
          aria-expanded={adding}
          className="flex h-8 items-center gap-1.5 rounded-[7px] border border-mri-border2 px-2 text-[11px] font-semibold text-mri-text2 transition-colors hover:border-mri-text2 hover:text-mri-text"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {m.chat_channel_add_member()}
        </button>

        {adding ? (
          <ul className="flex max-h-[220px] flex-col gap-0.5 overflow-y-auto rounded-[7px] border border-mri-border2 p-1">
            {/* ⚠ `addable`, never the members: "who may a mention name here" IS the members for a
                channel, so that list would offer only the people already inside. */}
            {addable.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => add.mutate(person.id)}
                  className="w-full truncate rounded-[5px] px-2 py-1.5 text-left text-[11.5px] text-mri-text transition-colors hover:bg-mri-rowhv"
                >
                  {person.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {isMember ? (
        <button
          type="button"
          onClick={() => setLeaving(true)}
          className="mt-auto flex-none border-t border-mri-border px-[14px] py-3 text-left text-[11px] font-semibold text-mri-text2 transition-colors hover:text-mri-bad"
        >
          {m.chat_channel_leave()}
        </button>
      ) : null}

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={m.chat_channel_leave()}
        description={m.chat_channel_leave_confirm({ name: conversation.title })}
        confirmLabel={m.chat_channel_leave()}
        onConfirm={() => leave.mutate()}
      />
    </aside>
  )
}
