import { claimsListOptions, type ClaimListItem } from '@mr/shared'
import { m } from '@mr/i18n'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { filterVisibleNavItems } from '~/config/navigation'
import { claimDetailTarget } from './claim-target'
import { commandPaletteNavItems } from './command-registry'
import { isSearchPending, SEARCH_MIN_CHARS } from './search-state'
import { useDebouncedValue } from './use-debounced-value'

const rootRoute = getRouteApi('__root__')
const MAX_CLAIM_RESULTS = 6

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

  const navItems = useMemo(() => {
    const visible = filterVisibleNavItems(commandPaletteNavItems, userPermissions)
    const normalized = trimmedQuery.toLowerCase()
    if (normalized.length === 0) {
      return visible
    }
    return visible.filter((item) => item.label().toLowerCase().includes(normalized))
  }, [userPermissions, trimmedQuery])

  const claimResults = (claimsQuery.data?.items ?? []).slice(0, MAX_CLAIM_RESULTS)

  function close(): void {
    setOpen(false)
    setQuery('')
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
    <CommandDialog open={open} onOpenChange={setOpen} title={m.command_palette_placeholder()}>
      <CommandInput
        placeholder={m.command_palette_placeholder()}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {searchPending ? null : <CommandEmpty>{m.command_palette_empty()}</CommandEmpty>}

        {navItems.length > 0 ? (
          <CommandGroup heading={m.command_palette_group_navigation()}>
            {navItems.map((item) => (
              <CommandItem key={item.key} value={`nav-${item.key}`} onSelect={() => goTo(item.to)}>
                <item.icon className="size-4 flex-none opacity-70" />
                {item.label()}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {searchEnabled && claimResults.length > 0 ? (
          <CommandGroup heading={m.command_palette_group_claims()}>
            {claimResults.map((claim) => (
              <CommandItem
                key={claim.id}
                value={`claim-${claim.id}`}
                onSelect={() => goToClaim(claim)}
              >
                <span className="font-mono text-xs">{claim.mrNumber ?? '—'}</span>
                <span className="truncate opacity-80">{claim.customerName ?? ''}</span>
                <span className="ml-auto text-[10px] uppercase opacity-60">{claim.kind}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  )
}
