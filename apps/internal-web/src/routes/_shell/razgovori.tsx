import { m } from '@mr/i18n'
import {
  ChatConversationType,
  chatConversationsOptions,
  chatKeys,
  deleteChatConversation,
  ClaimKind,
  type ChatConversationListItem,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Suspense, useState } from 'react'
import { z } from 'zod'

import { Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@mr/ui'

import { KindPill } from '~/components/kind-pill'
import { showInternalToast } from '~/lib/internal-toast'
import { ConversationList } from '~/features/chat/conversation-list'
import { ConversationPane } from '~/features/chat/conversation-pane'
import { NewThreadDialog } from '~/features/chat/new-thread-dialog'
import { ClaimThreadConfirm, findClaimThread } from '~/features/chat/open-claim-thread'
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
const FRAME_CLASSES =
  'flex h-[calc(100vh-var(--mri-topbar-h)-6.75rem)] min-h-[520px] overflow-hidden rounded-xl border border-mri-border bg-mri-bg'

function SkeletonBlock({ className }: { className: string }): React.ReactElement {
  return <div className={`animate-pulse rounded-lg bg-mri-inbg ${className}`} />
}

/** Two columns in their real widths, so nothing jumps when the answer arrives. */
function RazgovoriSkeleton(): React.ReactElement {
  return (
    <div className={FRAME_CLASSES} aria-hidden="true">
      <div className="flex w-[252px] flex-none flex-col gap-2 border-r border-mri-border bg-mri-surface p-3">
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

function RazgovoriColumns(): React.ReactElement {
  const { data } = useSuspenseQuery(chatConversationsOptions())
  const { razgovor: selectedId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const openConversation = (conversationId: string): void => {
    void navigate({ search: { razgovor: conversationId } })
  }
  const [pendingThread, setPendingThread] = useState<MrRegistryExistingClaim | null>(null)
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  // Kept across a switch on purpose (prototype L388): a person who wants the claim beside the
  // conversation wants it beside the next one too — and a channel simply has none to show.
  const [contextOpen, setContextOpen] = useState(false)
  const { userId, isAdmin, userName } = useInternalAuthUser()
  const [erasing, setErasing] = useState(false)
  const queryClient = useQueryClient()

  /**
   * A claim number clicked in a message. It opens the claim's thread — and when there is none,
   * it ASKS (spec §8.2). Nothing about clicking a word in a sentence says "make me a room".
   */
  const openClaim = (target: MrRegistryExistingClaim): void => {
    const existing = findClaimThread(data.items, target.claimId)
    if (existing === null) {
      setPendingThread(target)
      return
    }
    openConversation(existing.id)
  }

  /**
   * Erasing is for a room made by mistake (Nikola, 23.08.). The server refuses anybody who is not
   * an admin and refuses the general channel — this only asks.
   */
  const erase = useMutation({
    mutationFn: (conversationId: string) => deleteChatConversation(conversationId),
    onSuccess: async () => {
      setErasing(false)
      // Back to the general channel: the room that was open is gone.
      void navigate({ search: {} })
      await queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
      showInternalToast(m.chat_erase_done())
    },
  })

  // The general channel is where a person lands: it is the one conversation that always exists.
  const fallback =
    data.items.find((item) => item.type === ChatConversationType.General) ?? data.items[0] ?? null
  const current = data.items.find((item) => item.id === selectedId) ?? fallback

  return (
    <div className={FRAME_CLASSES}>
      <ConversationList
        items={data.items}
        activeId={current?.id ?? null}
        onSelect={openConversation}
        onNewThread={() => setNewThreadOpen(true)}
      />

      <section className="flex min-w-0 flex-1 flex-col bg-mri-bg">
        <header className="flex h-[52px] flex-none items-center gap-2.5 border-b border-mri-border bg-mri-surface px-4">
          {current === null ? null : (
            <>
              <ConversationHeading conversation={current} />
              <span className="ml-auto flex items-center gap-[7px]">
                <PinListButton
                  conversationId={current.id}
                  currentUserId={userId}
                  isAdmin={isAdmin}
                />
                {isAdmin && current.type !== ChatConversationType.General ? (
                  <button
                    type="button"
                    title={m.chat_erase()}
                    onClick={() => setErasing(true)}
                    className="grid size-7 cursor-pointer place-items-center rounded-[7px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-bad"
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
              onOpenConversation={openConversation}
            />
          </Suspense>
        )}
      </section>

      {current === null || !contextOpen ? null : (
        <ThreadContextPanel conversation={current} currentUserId={userId} isAdmin={isAdmin} />
      )}

      <NewThreadDialog
        open={newThreadOpen}
        onOpenChange={setNewThreadOpen}
        conversations={data.items}
        onOpened={openConversation}
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
