import { m } from '@mr/i18n'
import {
  CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE,
  chatChannelManagementOptions,
  chatMembersOptions,
  deleteChatConversation,
  invalidateChatConversationMetadataQueries,
  renameChatChannel,
  type ChatChannelManagementItem,
} from '@mr/shared'
import { cn, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle } from '@mr/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

import { showInternalToast } from '~/lib/internal-toast'

import { ChannelMembersEditor } from './channel-members-editor'

const CARD_CLASSES = cn(
  'fixed left-1/2 top-1/2 flex max-h-[88vh] w-[780px] max-w-[94vw] -translate-x-1/2 -translate-y-1/2 flex-col',
  'overflow-hidden rounded-[14px] border border-mri-border2 bg-mri-surface',
  'shadow-[0_28px_70px_rgba(0,0,0,.6)]',
)

export interface ChannelManagementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string
  selectedConversationId: string | null
  onDeleted: (conversationId: string) => void
}

/** Metadata-first channel administration; a roster is read only for the one selected row. */
export function ChannelManagementDialog({
  open,
  onOpenChange,
  currentUserId,
  selectedConversationId,
  onDeleted,
}: ChannelManagementDialogProps): React.ReactElement {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ChatChannelManagementItem | null>(null)

  useEffect(() => {
    if (search.trim() === debouncedSearch) {
      return undefined
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [debouncedSearch, search])

  const management = useQuery({
    ...chatChannelManagementOptions({
      search: debouncedSearch === '' ? undefined : debouncedSearch,
      page,
      pageSize: CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE,
    }),
    enabled: open,
  })
  const items = management.data?.items ?? []
  const inheritedSelection = items.some((item) => item.id === selectedConversationId)
    ? selectedConversationId
    : null
  const activeChannelId = selectedChannelId ?? inheritedSelection
  const selected = items.find((item) => item.id === activeChannelId) ?? null
  const roster = useQuery({
    ...chatMembersOptions(selected?.id ?? ''),
    enabled: open && selected !== null,
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameChatChannel(id, name),
    onSuccess: (_result, input) => {
      invalidateChatConversationMetadataQueries(queryClient, input.id)
      setDraftName(input.name)
    },
    onError: () => showInternalToast(m.chat_channel_failed()),
  })

  const erase = useMutation({
    mutationFn: (conversationId: string) => deleteChatConversation(conversationId),
    onSuccess: (_result, conversationId) => {
      setDeleteTarget(null)
      setSelectedChannelId(null)
      setDraftName(null)
      onDeleted(conversationId)
      showInternalToast(m.chat_erase_done())
    },
    onError: () => showInternalToast(m.chat_channel_failed()),
  })

  const reset = (): void => {
    setSearch('')
    setDebouncedSearch('')
    setPage(1)
    setSelectedChannelId(null)
    setDraftName(null)
    setDeleteTarget(null)
  }

  const totalPages = Math.max(
    1,
    Math.ceil((management.data?.total ?? 0) / CHAT_CHANNEL_MANAGEMENT_PAGE_SIZE),
  )
  const name = draftName ?? selected?.name ?? ''
  const trimmedName = name.trim()

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
        <header className="flex flex-none flex-col gap-1 border-b border-mri-border px-[18px] pb-3 pt-4">
          <DialogTitle className="text-balance font-mono text-[10px] font-bold tracking-[0.22em] text-mri-red">
            {m.chat_channel_manage()}
          </DialogTitle>
          <DialogDescription className="text-pretty text-[12px] text-mri-text2">
            {m.chat_channel_manage_description()}
          </DialogDescription>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto sm:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)] sm:overflow-hidden">
          <section className="flex min-h-[360px] min-w-0 flex-col gap-3 border-b border-mri-border p-4 sm:border-b-0 sm:border-r">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={m.chat_channel_manage_search()}
              aria-label={m.chat_channel_manage_search()}
              className="h-10 rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 text-[12px] text-mri-text outline-none focus:border-mri-red"
            />

            <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={item.id === activeChannelId}
                    onClick={() => {
                      setSelectedChannelId(item.id)
                      setDraftName(item.name)
                    }}
                    className={cn(
                      'flex min-h-14 w-full items-center gap-3 rounded-[9px] px-3 py-2 text-left transition-colors hover:bg-mri-rowhv',
                      item.id === activeChannelId && 'bg-[rgba(237,28,36,.11)]',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-mri-text">
                        {item.name}
                      </span>
                      <span className="block truncate text-[10.5px] text-mri-text2">
                        {item.creatorName === null
                          ? m.chat_channel_disabled_account()
                          : m.chat_channel_creator({ name: item.creatorName })}
                      </span>
                    </span>
                    <span className="flex-none font-mono text-[10px] tabular-nums text-mri-text2">
                      {m.chat_channel_member_count({ count: item.memberCount })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tabular-nums text-mri-text2">
                {m.emotive_claims_pagination_page_of({ page, totalPages })}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  aria-label={m.emotive_claims_pagination_previous()}
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="grid size-10 place-items-center rounded-[7px] border border-mri-border2 text-mri-text2 transition-colors hover:text-mri-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label={m.emotive_claims_pagination_next()}
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  className="grid size-10 place-items-center rounded-[7px] border border-mri-border2 text-mri-text2 transition-colors hover:text-mri-text disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              </span>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-3 overflow-y-auto p-4">
            {selected === null ? null : (
              <>
                <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-mri-text2">
                  {m.chat_channel_name_label()}
                  <input
                    value={name}
                    onChange={(event) => setDraftName(event.target.value)}
                    maxLength={80}
                    className="h-10 rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 text-[13px] font-normal text-mri-text outline-none focus:border-mri-red"
                  />
                </label>
                <button
                  type="button"
                  disabled={trimmedName === '' || rename.isPending}
                  onClick={() => rename.mutate({ id: selected.id, name: trimmedName })}
                  className="h-10 rounded-[9px] bg-mri-btn px-3 text-[11px] font-bold text-mri-btnfg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {m.action_save()}
                </button>

                {roster.data === undefined ? null : (
                  <div className="flex flex-col gap-2 border-t border-mri-border pt-3">
                    <span className="font-mono text-[8.5px] font-semibold tracking-[0.18em] text-mri-text2">
                      {m.chat_channel_members()}
                    </span>
                    <ChannelMembersEditor
                      conversationId={selected.id}
                      currentUserId={currentUserId}
                      members={roster.data.members}
                      addable={roster.data.addable}
                      canManage={roster.data.canManage}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setDeleteTarget(selected)}
                  className="mt-auto min-h-10 rounded-[9px] border border-mri-bad px-3 text-[11px] font-bold text-mri-bad transition-colors hover:bg-mri-rowhv"
                >
                  {m.chat_channel_delete()}
                </button>
              </>
            )}
          </section>
        </div>

        <footer className="flex flex-none justify-end border-t border-mri-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              reset()
              onOpenChange(false)
            }}
            className="h-10 rounded-[9px] border border-mri-border2 px-4 text-[11px] font-bold text-mri-text2 transition-colors hover:text-mri-text"
          >
            {m.action_close()}
          </button>
        </footer>

        <ConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(next) => {
            if (!next) {
              setDeleteTarget(null)
            }
          }}
          title={m.chat_erase_title()}
          description={m.chat_erase_description()}
          confirmLabel={m.chat_erase_confirm()}
          variant="destructive"
          pending={erase.isPending}
          onConfirm={() => {
            if (deleteTarget !== null) {
              erase.mutate(deleteTarget.id)
            }
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
