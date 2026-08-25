import { m } from '@mr/i18n'
import {
  ClaimKind,
  ClaimOutcome,
  claimsListOptions,
  formatClaimDetailMetaLine,
  useDebouncedValue,
  type ChatConversationListItem,
  type ClaimListItem,
  type MrRegistryExistingClaim,
} from '@mr/shared'
import { cn, Dialog, DialogContent, DialogDescription, DialogTitle } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { findClaimThread, useCreateClaimThread } from './open-claim-thread'

const SEARCH_DEBOUNCE_MS = 300
/** One page is what the 520px card can show; the search is how a claim further down is reached. */
const CLAIMS_PAGE_SIZE = 10

/**
 * The card, read from `cet-prototip.dc.html` L187: `width:430px; max-height:520px;
 * background:var(--surface); border:1px solid var(--border2); border-radius:14px;
 * box-shadow:0 28px 70px rgba(0,0,0,.6); animation:fadeUp .25s` — and `fadeUp` (L17) is
 * `opacity 0→1` plus `translateY(9px)→0`.
 */
const CARD_CLASSES = cn(
  'fixed left-1/2 top-1/2 flex max-h-[520px] w-[430px] -translate-x-1/2 -translate-y-1/2 flex-col',
  'overflow-hidden rounded-[14px] border border-mri-border2 bg-mri-surface',
  'shadow-[0_28px_70px_rgba(0,0,0,.6)]',
  'animate-in fade-in-0 slide-in-from-bottom-[9px] duration-[250ms] ease-[cubic-bezier(.22,1,.36,1)]',
)

/** L372, the two states of the right-hand badge. */
export const THREAD_BADGE_CLASSES =
  'ml-auto flex-none rounded-[6px] px-2 py-[3px] font-mono text-[8.5px] font-bold tracking-[0.1em]'

function claimTitle(claim: ClaimListItem): string {
  // A domestic claim need not have an MR number at all (spec §5) — then its own number names it.
  return claim.mrNumber ?? claim.claimNumber ?? '—'
}

function claimSubtitle(claim: ClaimListItem): string {
  return formatClaimDetailMetaLine([claim.customerName, claim.engineTypeCode, claim.engineCode])
}

function ClaimRow({
  claim,
  threadId,
  onPick,
}: {
  claim: ClaimListItem
  /** The thread this claim already has, or null — which is what the badge says out loud. */
  threadId: string | null
  onPick: (claim: ClaimListItem, threadId: string | null) => void
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={() => onPick(claim, threadId)}
      className="flex h-11 items-center gap-[9px] rounded-[9px] px-[10px] text-left transition-colors hover:bg-mri-rowhv"
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-[7px] flex-none rounded-full',
          claim.kind === ClaimKind.Domace ? 'bg-mri-domace' : 'bg-mri-info',
        )}
      />
      <span className="flex min-w-0 flex-col leading-[1.3]">
        <span className="truncate font-mono text-[12px] font-semibold text-mri-text">
          {claimTitle(claim)}
        </span>
        <span className="truncate text-[10.5px] text-mri-text2">{claimSubtitle(claim)}</span>
      </span>
      <span
        className={cn(
          THREAD_BADGE_CLASSES,
          threadId === null
            ? 'border border-[rgba(31,169,113,.4)] bg-[rgba(31,169,113,.1)] text-mri-ok'
            : 'border border-mri-border2 text-mri-text2',
        )}
      >
        {threadId === null ? m.chat_new_thread_create() : m.chat_new_thread_exists()}
      </span>
    </button>
  )
}

export interface NewThreadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The conversations already on screen — what makes a row say POSTOJI instead of NAPRAVI. */
  conversations: readonly ChatConversationListItem[]
  onOpened: (conversationId: string) => void
  onClosed: (claim: MrRegistryExistingClaim) => void
}

/**
 * „Nova nit" — pick a claim, and talk about it.
 *
 * The list is the ordinary claims search (the same endpoint the ⌘K palette and the claims screen
 * read), so nothing new had to be invented for it and the office's own search rules apply. The
 * badge is the whole decision: a claim with a thread is entered, a claim without one gets one —
 * and only then, because "1 claim = 1 thread" is a constraint, not a convention.
 */
export function NewThreadDialog({
  open,
  onOpenChange,
  conversations,
  onOpened,
  onClosed,
}: NewThreadDialogProps): React.ReactElement {
  const [query, setQuery] = useState('')
  const search = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS)

  const claims = useQuery({
    ...claimsListOptions(
      { outcome: ClaimOutcome.Pending, ...(search === '' ? {} : { search }) },
      1,
      CLAIMS_PAGE_SIZE,
    ),
    enabled: open,
  })

  const create = useCreateClaimThread({
    onOpened: (conversationId) => {
      onOpenChange(false)
      onOpened(conversationId)
    },
    onClosed: (claim) => {
      onOpenChange(false)
      onClosed(claim)
    },
  })

  const handlePick = (claim: ClaimListItem, threadId: string | null): void => {
    if (threadId !== null) {
      onOpenChange(false)
      onOpened(threadId)
      return
    }
    create.mutate({ kind: claim.kind, claimId: claim.id })
  }

  const items = claims.data?.items ?? []

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery('')
        }
        onOpenChange(next)
      }}
    >
      <DialogContent unstyled hideClose overlayClassName="bg-black/55" className={CARD_CLASSES}>
        <div className="flex flex-none flex-col gap-1 border-b border-mri-border px-[18px] pb-3 pt-4">
          <DialogTitle className="font-mono text-[10px] font-bold tracking-[0.22em] text-mri-red">
            {m.chat_new_thread_eyebrow()}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-mri-text2">
            {m.chat_new_thread_hint()}
          </DialogDescription>
        </div>

        <div className="flex-none px-[14px] pb-1.5 pt-3">
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={m.chat_new_thread_search()}
            aria-label={m.chat_new_thread_search()}
            className="h-[38px] w-full rounded-[9px] border border-mri-border2 bg-mri-inbg px-3 text-[12.5px] font-medium text-mri-text outline-none placeholder:text-mri-text2 focus:border-mri-red focus:shadow-[0_0_0_3px_rgba(237,28,36,.18)]"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2.5 pt-1">
          {claims.isPending ? (
            <div aria-hidden="true" className="flex flex-col gap-0.5">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-11 animate-pulse rounded-[9px] bg-mri-inbg" />
              ))}
            </div>
          ) : null}

          {claims.isError ? (
            <p role="alert" className="px-[10px] py-2 text-[11.5px] text-mri-bad">
              {m.chat_new_thread_error()}
            </p>
          ) : null}

          {!claims.isPending && !claims.isError && items.length === 0 ? (
            <p role="status" className="px-[10px] py-2 text-[11.5px] text-mri-text2">
              {m.chat_new_thread_empty()}
            </p>
          ) : null}

          {items.map((claim) => (
            <ClaimRow
              key={claim.id}
              claim={claim}
              threadId={findClaimThread(conversations, claim.id)?.id ?? null}
              onPick={handlePick}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
