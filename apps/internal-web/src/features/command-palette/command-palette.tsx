import { ClaimKind, claimsListOptions, type ClaimListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import {
  cn,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { File, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { filterVisibleNavItems } from '~/config/navigation'
import { claimDetailTarget } from './claim-target'
import { commandPaletteActionItems, commandPaletteNavItems } from './command-registry'
import { isSearchPending, SEARCH_MIN_CHARS } from './search-state'
import { useDebouncedValue } from './use-debounced-value'

const rootRoute = getRouteApi('__root__')
const MAX_CLAIM_RESULTS = 6

/**
 * Glass chrome (design handoff 2026-07-21). The panel surface, its text scale and
 * its edges come from the shared `.mri-glass` recipe in globals.css — this file
 * only places and sizes things. `--mrg-*` are that recipe's glass-local tokens.
 */
const PANEL_CLASSES =
  'mri-glass mri-glass-in left-1/2 top-[16%] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 rounded-[20px]'

const COMMAND_CHROME_CLASSES = cn(
  'bg-transparent text-[var(--mrg-text)]',
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2.5',
  '[&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold',
  '[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-[var(--mrg-text2)]',
  // A group that follows another one gets a little more air above its heading.
  '[&_[cmdk-group]+[cmdk-group]_[cmdk-group-heading]]:pt-3',
)

/** 46px row that turns into a glass tile when cmdk selects it (hover or arrow keys). */
const ROW_CLASSES = cn(
  'h-[46px] gap-3 rounded-[12px] border border-transparent px-3.5 py-0 text-[14.5px]',
  'hover:bg-[var(--mrg-hover)]',
  'data-[selected=true]:border-[var(--mrg-sel-border)] data-[selected=true]:bg-[var(--mrg-sel)]',
  'data-[selected=true]:text-[var(--mrg-text)] data-[selected=true]:shadow-[var(--mrg-sel-inset)]',
)

const KBD_CLASSES =
  'rounded-[6px] border border-[var(--mrg-kbd-border)] bg-[var(--mrg-kbd-bg)] font-mono text-[10px] font-semibold'

const KIND_PILL_CLASSES =
  'ml-auto flex-none rounded-full border px-2.5 py-[3.5px] font-mono text-[10px] font-semibold tracking-[0.08em]'

/** ⌘K palette: jump to a screen, or straight to a claim via unified FTS search. */
export function CommandPalette(): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { authSession } = rootRoute.useRouteContext()
  const userPermissions = authSession?.user?.permissions ?? []

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const trimmedQuery = query.trim()
  const debouncedQuery = useDebouncedValue(trimmedQuery, 300)
  const searchEnabled = debouncedQuery.length >= SEARCH_MIN_CHARS

  const claimsQuery = useQuery({
    ...claimsListOptions({ search: debouncedQuery }, 1, 10),
    enabled: open && searchEnabled,
  })

  const searchPending = isSearchPending(trimmedQuery, debouncedQuery, claimsQuery.isFetching)

  const navItems = useMemo(
    () => filterMatching(commandPaletteNavItems, userPermissions, trimmedQuery),
    [userPermissions, trimmedQuery],
  )

  const actionItems = useMemo(
    () => filterMatching(commandPaletteActionItems, userPermissions, trimmedQuery),
    [userPermissions, trimmedQuery],
  )

  const claimResults = (claimsQuery.data?.items ?? []).slice(0, MAX_CLAIM_RESULTS)

  /** Esc, outside-click and every selection route through here, so the next ⌘K
   *  always opens on a clean palette instead of the last thing that was typed. */
  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery('')
    }
  }

  function close(): void {
    handleOpenChange(false)
  }

  function goTo(to: string): void {
    close()
    navigate({ to })
  }

  function goToClaim(claim: ClaimListItem): void {
    close()
    navigate(claimDetailTarget(claim))
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={m.command_palette_placeholder()}
      unstyled
      overlayClassName="mri-glass-overlay"
      contentClassName={PANEL_CLASSES}
      commandClassName={COMMAND_CHROME_CLASSES}
    >
      <CommandInput
        placeholder={m.command_palette_placeholder()}
        value={query}
        onValueChange={setQuery}
        wrapperClassName="gap-[13px] border-[var(--mrg-sep)] px-5 py-4"
        icon={
          <Search className="size-[19px] flex-none text-[var(--mrg-text2)]" aria-hidden="true" />
        }
        className="h-auto py-0 text-[16px] text-[var(--mrg-text)] placeholder:text-[var(--mrg-text2)]"
      />
      <CommandList className="max-h-[60vh] p-[10px]">
        {searchPending ? null : (
          <CommandEmpty className="py-6 text-center text-[13.5px] text-[var(--mrg-text2)]">
            {m.command_palette_empty()}
          </CommandEmpty>
        )}

        {searchEnabled && claimResults.length > 0 ? (
          <CommandGroup heading={m.command_palette_group_claims()} className="p-0">
            {claimResults.map((claim) => (
              <CommandItem
                key={claim.id}
                value={`claim-${claim.id}`}
                onSelect={() => goToClaim(claim)}
                className={ROW_CLASSES}
              >
                <File className="size-[17px] flex-none text-[var(--mrg-icon)]" aria-hidden="true" />
                <span className="font-mono text-[13.5px] font-semibold">
                  {claim.mrNumber ?? '—'}
                </span>
                <span className="truncate text-[14px] text-[var(--mrg-text2)]">
                  {claim.customerName ?? ''}
                </span>
                <KindPill kind={claim.kind} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {navItems.length > 0 ? (
          <CommandGroup heading={m.command_palette_group_navigation()} className="p-0">
            {navItems.map((item, index) => (
              <CommandItem
                key={item.key}
                value={`nav-${item.key}`}
                onSelect={() => goTo(item.to)}
                className={ROW_CLASSES}
              >
                <span
                  aria-hidden="true"
                  className="w-5 flex-none font-mono text-[11px] font-semibold text-[var(--mrg-text2)]"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                {item.label()}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {actionItems.length > 0 ? (
          <CommandGroup heading={m.command_palette_group_actions()} className="p-0">
            {actionItems.map((item) => (
              <CommandItem
                key={item.key}
                value={`action-${item.key}`}
                onSelect={() => goTo(item.to)}
                className={ROW_CLASSES}
              >
                <span
                  aria-hidden="true"
                  className="w-5 flex-none text-center text-[15px] text-mri-redh"
                >
                  +
                </span>
                {item.label()}
                <span className={cn(KBD_CLASSES, 'ml-auto px-[7px] py-[2.5px]')} aria-hidden="true">
                  ↵
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>

      <div className="flex items-center gap-4 border-t border-[var(--mrg-sep)] bg-[var(--mrg-footer-bg)] px-[18px] py-2.5">
        <FooterHint keys="↑↓" label={m.command_palette_hint_move()} />
        <FooterHint keys="↵" label={m.command_palette_hint_open()} />
        <FooterHint keys="esc" label={m.command_palette_hint_close()} />
        <span className="ml-auto font-mono text-[10px] tracking-[0.14em] text-[var(--mrg-text2)] opacity-75">
          MR ENGINES · INTERNO
        </span>
      </div>
    </CommandDialog>
  )
}

function KindPill({ kind }: { kind: ClaimListItem['kind'] }): React.ReactElement {
  const isEmotive = kind === ClaimKind.Emotive
  return (
    <span
      className={cn(
        KIND_PILL_CLASSES,
        isEmotive
          ? 'border-[var(--mrg-emotive-border)] bg-[var(--mrg-emotive-bg)] text-[var(--mrg-emotive-text)]'
          : 'border-[var(--mrg-domace-border)] bg-[var(--mrg-domace-bg)] text-[var(--mrg-domace-text)]',
      )}
    >
      {isEmotive ? m.claims_kind_emotive() : m.claims_kind_domace()}
    </span>
  )
}

function FooterHint({ keys, label }: { keys: string; label: string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-[7px] font-mono text-[10px] tracking-[0.06em] text-[var(--mrg-text2)]">
      <span className={cn(KBD_CLASSES, 'px-1.5 py-[2.5px]')}>{keys}</span>
      {label}
    </span>
  )
}

/** Permission gate first, then the palette's own substring match on the label. */
function filterMatching<
  T extends { label: () => string; permission?: string; permissions?: readonly string[] },
>(items: readonly T[], userPermissions: readonly string[], query: string): T[] {
  const visible = filterVisibleNavItems(items, userPermissions)
  const normalized = query.toLowerCase()
  if (normalized.length === 0) {
    return visible
  }
  return visible.filter((item) => item.label().toLowerCase().includes(normalized))
}
