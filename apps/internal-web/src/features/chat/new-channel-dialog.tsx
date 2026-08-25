import { m } from '@mr/i18n'
import {
  chatPeopleOptions,
  createChatChannel,
  invalidateChatConversationMetadataQueries,
} from '@mr/shared'
import { cn, Dialog, DialogContent, DialogDescription, DialogTitle } from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

/** The frame the „Nova nit" dialog beside it already uses — two dialogs in one screen, one look. */
const CARD_CLASSES = cn(
  'fixed left-1/2 top-1/2 flex w-[430px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col',
  'overflow-hidden rounded-[14px] border border-mri-border2 bg-mri-surface',
  'shadow-[0_28px_70px_rgba(0,0,0,.6)]',
  'animate-in fade-in-0 slide-in-from-bottom-[9px] duration-[250ms] ease-[cubic-bezier(.22,1,.36,1)]',
)

export interface NewChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  generalConversationId: string | null
  currentUserId: string
  /** Opens the channel that was just made — a room nobody walks into is a room nobody uses. */
  onCreated: (conversationId: string) => void
}

/**
 * „Nov kanal". Anybody in the chat may make one (Nikola, 2026-08-24) — the same as opening a
 * claim's thread, and for the same reason: a room is work, not a privilege.
 *
 * The General roster is the whole internal office. It is fetched only while this dialog is open,
 * then narrowed locally — a search endpoint for a handful of colleagues is needless machinery.
 */
export function NewChannelDialog({
  open,
  onOpenChange,
  generalConversationId,
  currentUserId,
  onCreated,
}: NewChannelDialogProps): React.ReactElement {
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [memberIds, setMemberIds] = useState<string[]>([])
  const queryClient = useQueryClient()
  const people = useQuery({
    ...chatPeopleOptions(generalConversationId ?? ''),
    enabled: open && generalConversationId !== null,
  })

  const reset = (): void => {
    setName('')
    setSearch('')
    setMemberIds([])
  }

  const create = useMutation({
    mutationFn: createChatChannel,
    onSuccess: (channel) => {
      invalidateChatConversationMetadataQueries(queryClient, channel.id)
      reset()
      onOpenChange(false)
      onCreated(channel.id)
    },
    onError: () => showInternalToast(m.chat_channel_failed()),
  })

  const trimmed = name.trim()
  const needle = search.trim().toLocaleLowerCase()
  const selectablePeople = (people.data?.items ?? []).filter(
    (person) =>
      person.id !== currentUserId &&
      (needle === '' || person.name.toLocaleLowerCase().includes(needle)),
  )

  const toggleMember = (personId: string): void => {
    setMemberIds((selected) =>
      selected.includes(personId)
        ? selected.filter((selectedId) => selectedId !== personId)
        : [...selected, personId],
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
        }
        onOpenChange(next)
      }}
    >
      <DialogContent unstyled hideClose overlayClassName="bg-black/55" className={CARD_CLASSES}>
        <div className="flex flex-none flex-col gap-1 border-b border-mri-border px-[18px] pb-3 pt-4">
          <DialogTitle className="font-mono text-[10px] font-bold tracking-[0.22em] text-mri-red">
            {m.chat_channel_new_title()}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-mri-text2">
            {m.chat_channel_name_label()}
          </DialogDescription>
        </div>

        <form
          className="flex flex-col gap-3 px-[18px] py-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (trimmed !== '') {
              create.mutate({ name: trimmed, memberIds })
            }
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={m.chat_channel_name_placeholder()}
            maxLength={80}
            aria-label={m.chat_channel_name_label()}
            className="h-10 rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 text-[13px] text-mri-text outline-none focus:border-mri-red"
          />
          <p className="rounded-[7px] border border-mri-border2 bg-mri-inbg px-3 py-2 text-[11px] leading-[1.45] text-mri-text2">
            {m.chat_channel_history_warning()}
          </p>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={m.chat_channel_people_search()}
            aria-label={m.chat_channel_people_search()}
            className="h-9 rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 text-[12px] text-mri-text outline-none focus:border-mri-red"
          />
          <ul className="max-h-[180px] overflow-y-auto rounded-[9px] border border-mri-border2 p-1">
            {selectablePeople.map((person) => (
              <li key={person.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-[12px] text-mri-text hover:bg-mri-rowhv">
                  <input
                    type="checkbox"
                    checked={memberIds.includes(person.id)}
                    onChange={() => toggleMember(person.id)}
                    aria-label={person.name}
                    className="size-4 flex-none cursor-pointer rounded-[4px] border border-mri-border2 bg-mri-inbg accent-mri-red"
                  />
                  <span className="grid size-6 flex-none place-items-center rounded-full bg-mri-inbg font-mono text-[9px] font-bold text-mri-text2">
                    {person.initials}
                  </span>
                  <span className="truncate">{person.name}</span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="submit"
            disabled={trimmed === '' || create.isPending}
            className="h-10 rounded-[9px] bg-mri-btn text-[11px] font-bold tracking-[0.06em] text-mri-btnfg transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {m.chat_channel_create()}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
