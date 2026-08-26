import { m } from '@mr/i18n'
import {
  ChatConversationType,
  chatConversationsOptions,
  deleteChatConversation,
  invalidateChatConversationMetadataQueries,
  ClaimDetailTab,
  ClaimKind,
  type ChatConversationListItem,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
  type QueryClient,
} from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useState } from 'react'
import { z } from 'zod'

import { ChevronLeft, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@mr/ui'

import { KindPill } from '~/components/kind-pill'
import { showInternalToast } from '~/lib/internal-toast'
import {
  CHAT_FRAME_CLASSES,
  CHAT_LIST_BACKDROP_CLASSES,
  CHAT_LIST_COLUMN_CLASSES,
  CHAT_LIST_TOGGLE_CLASSES,
  CHAT_PANEL_BACKDROP_CLASSES,
} from '~/features/chat/chat-layout'
import { ConversationList } from '~/features/chat/conversation-list'
import { ConversationPane } from '~/features/chat/conversation-pane'
import { ChannelPanel } from '~/features/chat/channel-panel'
import { ChannelManagementDialog } from '~/features/chat/channel-management-dialog'
import { NewChannelDialog } from '~/features/chat/new-channel-dialog'
import { NewThreadDialog } from '~/features/chat/new-thread-dialog'
import { ClaimThreadConfirm, useResolveClaimThread } from '~/features/chat/open-claim-thread'
import { PinListButton } from '~/features/chat/pin-list'
import { ThreadContextPanel, ThreadContextToggle } from '~/features/chat/thread-context-panel'
import { internalRequireAppAccess } from '~/lib/auth-guard'
import { useInternalAuthUser } from '~/lib/use-internal-auth-user'

/**
 * The open conversation lives in the address, not in component state.
 *
 * Two things need it there: a mention notification has to land in the room it happened in, and a
 * person has to be able to send a colleague a link to a conversation. An id that matches nothing
 * falls back to the general channel rather than showing an error — a stale link is not a fault.
 */
const razgovoriSearchSchema = z.object({ razgovor: z.string().uuid().optional() })

export const Route = createFileRoute('/_shell/razgovori')({
  validateSearch: (search) => razgovoriSearchSchema.parse(search),
  // Whoever may enter the internal app may talk in it — written in permissions, exactly like the
  // API's own gate on the whole chat module.
  beforeLoad: internalRequireAppAccess(),
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(chatConversationsOptions()),
  staticData: { crumb: m.nav_razgovori },
  component: RazgovoriComponent,
})

/**
 * The chat fills what is left of the viewport: the topbar, plus the shell's own `pt-9` and
 * `pb-[72px]` around every page (36px + 72px = 6.75rem). It scrolls inside its columns, never
 * as a page — a conversation that pushes the composer below the fold is not a conversation.
 */

function SkeletonBlock({ className }: { className: string }): React.ReactElement {
  return <div className={`animate-pulse rounded-lg bg-mri-inbg ${className}`} />
}

/** Two columns in their real widths, so nothing jumps when the answer arrives. */
function RazgovoriSkeleton(): React.ReactElement {
  return (
    <div className={CHAT_FRAME_CLASSES} aria-hidden="true">
      {/* The same rule as the real list, or the skeleton draws a column the screen it stands in
          for will not have — which is the jump a skeleton exists to prevent. */}
      <div
        className={`flex w-[252px] flex-none flex-col gap-2 border-r border-mri-border bg-mri-surface p-3 ${CHAT_LIST_COLUMN_CLASSES}`}
      >
        <SkeletonBlock className="h-[34px] w-full" />
        <SkeletonBlock className="mt-2 h-9 w-full" />
        <SkeletonBlock className="h-9 w-full" />
        <SkeletonBlock className="h-10 w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[52px] flex-none items-center border-b border-mri-border bg-mri-surface px-4">
          <SkeletonBlock className="h-4 w-40" />
        </div>
      </div>
    </div>
  )
}

function ConversationHeading({
  conversation,
}: {
  conversation: ChatConversationListItem
}): React.ReactElement {
  if (conversation.type === ChatConversationType.Claim) {
    return (
      <>
        <span className="font-mono text-[13.5px] font-bold text-mri-text">
          {conversation.title}
        </span>
        {conversation.claimKind === null ? null : (
          <KindPill
            kind={
              conversation.claimKind === ClaimKind.Domace ? ClaimKind.Domace : ClaimKind.Emotive
            }
          />
        )}
        <span className="truncate text-[10.5px] text-mri-text2">{conversation.subtitle}</span>
      </>
    )
  }

  return (
    <>
      <span className="text-[14px] font-extrabold text-mri-text">
        <span aria-hidden="true" className="font-mono text-mri-text2">
          #
        </span>{' '}
        {conversation.title}
      </span>
      <span className="truncate font-mono text-[10px] font-medium text-mri-text2">
        {conversation.subtitle}
      </span>
    </>
  )
}

/** The pane's own waiting state — switching conversations must never blank the list beside it. */
function MessagesSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-3.5 p-4" aria-hidden="true">
      <SkeletonBlock className="h-10 w-2/3" />
      <SkeletonBlock className="h-10 w-1/2" />
      <SkeletonBlock className="h-10 w-3/5" />
    </div>
  )
}

export function handleChannelDeleted({
  queryClient,
  deletedId,
  selectedId,
  generalId,
  selectConversation,
}: {
  queryClient: QueryClient
  deletedId: string
  selectedId: string | null
  generalId: string | null
  selectConversation: (conversationId: string) => void
}): void {
  invalidateChatConversationMetadataQueries(queryClient, deletedId)
  if (deletedId === selectedId && generalId !== null) {
    selectConversation(generalId)
  }
}

function RazgovoriColumns(): React.ReactElement {
  const { data } = useSuspenseQuery(chatConversationsOptions())
  const { razgovor: selectedId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const openConversation = (conversationId: string): void => {
    void navigate({ search: { razgovor: conversationId } })
    // Picking a room is the whole reason the sheet was open.
    setListOpen(false)
  }
  /**
   * Only means anything below CHAT_LIST_BREAKPOINT. It starts open when nothing is selected —
   * arriving at /razgovori with no room in the URL should show the rooms, not an empty column.
   */
  const [listOpen, setListOpen] = useState(selectedId === undefined)
  const [pendingThread, setPendingThread] = useState<MrRegistryExistingClaim | null>(null)
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [newChannelOpen, setNewChannelOpen] = useState(false)
  const [channelManagementOpen, setChannelManagementOpen] = useState(false)
  // Kept across a switch on purpose (prototype L388): a person who wants the claim beside the
  // conversation wants it beside the next one too — and a channel simply has none to show.
  const [contextOpen, setContextOpen] = useState(false)
  const { userId, isAdmin, userName } = useInternalAuthUser()
  const [erasing, setErasing] = useState(false)
  const queryClient = useQueryClient()

  const openClaimDetail = (target: MrRegistryExistingClaim): void => {
    if (target.kind === ClaimKind.Emotive) {
      void navigate({
        to: '/reklamacije/emotive/$id',
        params: { id: target.claimId },
        search: { tab: ClaimDetailTab.Razgovor },
      })
      return
    }
    void navigate({
      to: '/reklamacije/domace/$id',
      params: { id: target.claimId },
      search: { tab: ClaimDetailTab.Razgovor },
    })
  }

  const resolveClaim = useResolveClaimThread({
    onActive: openConversation,
    onMissing: setPendingThread,
    onClosed: openClaimDetail,
  })

  /**
   * A claim number clicked in a message. It opens the claim's thread — and when there is none,
   * it ASKS (spec §8.2). Nothing about clicking a word in a sentence says "make me a room".
   */
  const openClaim = (target: MrRegistryExistingClaim): void => {
    resolveClaim.mutate(target)
  }

  /**
   * Erasing is for a room made by mistake (Nikola, 23.08.). The server refuses anybody who is not
   * an admin and refuses the general channel — this only asks.
   */
  const erase = useMutation({
    mutationFn: (conversationId: string) => deleteChatConversation(conversationId),
    onSuccess: (_result, deletedConversationId) => {
      setErasing(false)
      // Back to the general channel: the room that was open is gone.
      void navigate({ search: {} })
      invalidateChatConversationMetadataQueries(queryClient, deletedConversationId)
      showInternalToast(m.chat_erase_done())
    },
  })

  // The general channel is where a person lands: it is the one conversation that always exists.
  const general = data.items.find((item) => item.type === ChatConversationType.General) ?? null
  const fallback = general ?? data.items[0] ?? null
  const current = data.items.find((item) => item.id === selectedId) ?? fallback
  const onChannelDeleted = (deletedId: string): void => {
    handleChannelDeleted({
      queryClient,
      deletedId,
      selectedId: current?.id ?? null,
      generalId: general?.id ?? null,
      selectConversation: openConversation,
    })
    setContextOpen(false)
  }

  return (
    <div
      className={CHAT_FRAME_CLASSES}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') {
          return
        }
        /*
         * ⚠ Only when a sheet is actually out.
         *
         * Escape bubbles: the mention menu closes itself with `preventDefault()` and no
         * `stopPropagation()`, and Radix's dismiss layer does not stop it either. Firing
         * unconditionally therefore tore the claim panel down from the THIRD COLUMN on a wide
         * screen whenever somebody pressed Escape in the lightbox or the mention menu — a column
         * that was never a sheet in the first place.
         */
        if (!listOpen && !contextOpen) {
          return
        }
        setListOpen(false)
        setContextOpen(false)
      }}
    >
      {listOpen ? (
        <button
          type="button"
          aria-label={m.chat_close_list()}
          onClick={() => setListOpen(false)}
          className={CHAT_LIST_BACKDROP_CLASSES}
        />
      ) : null}

      <ConversationList
        userId={userId}
        items={data.items}
        activeId={current?.id ?? null}
        onSelect={openConversation}
        onNewThread={() => setNewThreadOpen(true)}
        onNewChannel={() => setNewChannelOpen(true)}
        onManageChannels={() => setChannelManagementOpen(true)}
        open={listOpen}
      />

      <section className="flex min-w-0 flex-1 flex-col bg-mri-bg">
        <header className="flex h-[52px] flex-none items-center gap-2.5 border-b border-mri-border bg-mri-surface px-4">
          {current === null ? null : (
            <>
              <button
                type="button"
                title={m.chat_open_list()}
                onClick={() => setListOpen(true)}
                className={CHAT_LIST_TOGGLE_CLASSES}
              >
                <ChevronLeft aria-hidden="true" className="size-[15px]" />
                <span className="sr-only">{m.chat_open_list()}</span>
              </button>
              <ConversationHeading conversation={current} />
              <span className="ml-auto flex items-center gap-[7px]">
                <PinListButton
                  conversationId={current.id}
                  currentUserId={userId}
                  isAdmin={isAdmin}
                />
                {isAdmin && current.type === ChatConversationType.Claim ? (
                  <button
                    type="button"
                    title={m.chat_erase()}
                    onClick={() => setErasing(true)}
                    className="grid size-10 cursor-pointer place-items-center rounded-[7px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-bad"
                  >
                    <Trash2 aria-hidden="true" className="size-[13px]" />
                    <span className="sr-only">{m.chat_erase()}</span>
                  </button>
                ) : null}
                <ThreadContextToggle
                  conversation={current}
                  open={contextOpen}
                  onToggle={() => setContextOpen((open) => !open)}
                />
              </span>
            </>
          )}
        </header>
        {current === null ? null : (
          // Keyed by the conversation: the NOVO rule, the scroll position and anything still in
          // flight belong to the one that is open, and none of them may follow it to the next.
          <Suspense key={current.id} fallback={<MessagesSkeleton />}>
            <ConversationPane
              conversationId={current.id}
              unreadCount={current.unreadCount}
              authorName={userName}
              authorId={userId}
              isAdmin={isAdmin}
              isThread={current.type === ChatConversationType.Claim}
              onOpenClaim={openClaim}
              onOpenClosedClaim={openClaimDetail}
              onOpenConversation={openConversation}
            />
          </Suspense>
        )}
      </section>

      {current === null || !contextOpen ? null : (
        <>
          {/* The way back out. Below CHAT_PANEL_BREAKPOINT the panel covers the ⓘ that opened it,
              and a tablet has no Escape key — without this, one tap ends the conversation. */}
          <button
            type="button"
            aria-label={m.chat_close_panel()}
            onClick={() => setContextOpen(false)}
            className={CHAT_PANEL_BACKDROP_CLASSES}
          />
          {/* A channel's panel is its people; a claim thread's is the claim. Same slot, and the
              same overlay rule below CHAT_PANEL_BREAKPOINT. */}
          {current.type === ChatConversationType.Channel ? (
            <ChannelPanel
              conversation={current}
              currentUserId={userId}
              onDeleted={onChannelDeleted}
            />
          ) : (
            <ThreadContextPanel conversation={current} currentUserId={userId} isAdmin={isAdmin} />
          )}
        </>
      )}

      <NewChannelDialog
        open={newChannelOpen}
        onOpenChange={setNewChannelOpen}
        generalConversationId={general?.id ?? null}
        currentUserId={userId}
        onCreated={openConversation}
      />

      <ChannelManagementDialog
        open={channelManagementOpen}
        onOpenChange={setChannelManagementOpen}
        currentUserId={userId}
        selectedConversationId={current?.id ?? null}
        onDeleted={onChannelDeleted}
      />

      <NewThreadDialog
        open={newThreadOpen}
        onOpenChange={setNewThreadOpen}
        conversations={data.items}
        onOpened={openConversation}
        onClosed={openClaimDetail}
      />

      <ConfirmDialog
        open={erasing}
        onOpenChange={setErasing}
        title={m.chat_erase_title()}
        description={m.chat_erase_description()}
        confirmLabel={m.chat_erase_confirm()}
        variant="destructive"
        pending={erase.isPending}
        onConfirm={() => {
          if (current !== null) {
            erase.mutate(current.id)
          }
        }}
      />

      <ClaimThreadConfirm
        target={pendingThread}
        onCancel={() => setPendingThread(null)}
        onOpened={(conversationId) => {
          setPendingThread(null)
          openConversation(conversationId)
        }}
        onClosed={(claim) => {
          setPendingThread(null)
          openClaimDetail(claim)
        }}
      />
    </div>
  )
}

function RazgovoriComponent(): React.ReactElement {
  return (
    <Suspense fallback={<RazgovoriSkeleton />}>
      <RazgovoriColumns />
    </Suspense>
  )
}
