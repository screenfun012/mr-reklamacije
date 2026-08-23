import { m } from '@mr/i18n'
import {
  ChatConversationType,
  chatConversationsOptions,
  ClaimKind,
  type ChatConversationListItem,
} from '@mr/shared'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense, useState } from 'react'

import { KindPill } from '~/components/kind-pill'
import { ConversationList } from '~/features/chat/conversation-list'
import { internalRequireAppAccess } from '~/lib/auth-guard'

export const Route = createFileRoute('/_shell/razgovori')({
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

function RazgovoriColumns(): React.ReactElement {
  const { data } = useSuspenseQuery(chatConversationsOptions())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // The general channel is where a person lands: it is the one conversation that always exists.
  const fallback =
    data.items.find((item) => item.type === ChatConversationType.General) ?? data.items[0] ?? null
  const current = data.items.find((item) => item.id === selectedId) ?? fallback

  return (
    <div className={FRAME_CLASSES}>
      <ConversationList
        items={data.items}
        activeId={current?.id ?? null}
        onSelect={setSelectedId}
      />

      <section className="flex min-w-0 flex-1 flex-col bg-mri-bg">
        <header className="flex h-[52px] flex-none items-center gap-2.5 border-b border-mri-border bg-mri-surface px-4">
          {current === null ? null : <ConversationHeading conversation={current} />}
        </header>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-[12px] text-mri-text2">
          {m.chat_messages_placeholder()}
        </div>
      </section>
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
