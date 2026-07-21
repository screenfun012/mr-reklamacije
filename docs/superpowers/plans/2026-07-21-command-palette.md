# Command palette (⌘K) — internal-web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ⌘K command palette in `internal-web` — jump to any screen, and jump straight to any claim by typing (live FTS search).

**Architecture:** A shadcn `Command` primitive (on `cmdk`) added to `@mr/ui`; the palette feature (keybinding, command registry, claim-search wiring) in `internal-web`, mounted once in the `_shell` layout. Reuses the existing `internalNavItems` registry, the sidebar's permission filter, and the existing `GET /api/claims?search=` FTS endpoint. No backend change.

**Tech Stack:** React 19, TanStack Router/Query, `cmdk`, shadcn/ui + Tailwind v4, Paraglide i18n, Vitest + Testing Library.

## Global Constraints

- No semicolons, single quotes, 2-space indent, trailing commas (Prettier). Files kebab-case; components PascalCase; one primary export/file.
- `strict` TS; no `any`, no non-null `!`, no `enum` (use `as const`). Explicit return types on exported/hook functions.
- Colors only via `mri-*` / `mr-*` tokens (internal-web uses `mri-*`). No hardcoded palette colors.
- Every user string via Paraglide `m.*`, keys in BOTH `sr` and `en` catalogs (CI checks parity). Serbian primary, informal "ti".
- Permission gating is courtesy in the UI; the server stays the judge. Palette must add no new access.
- Editing `@mr/ui` requires the CLAUDE.md §4 restart procedure: `pnpm --filter @mr/ui build` before dev/typecheck picks up new exports.
- Full gate green before any commit: `pnpm format:check && pnpm exec turbo run build typecheck lint test --force && pnpm --filter api depcruise && pnpm test:integration`. Do NOT push (Nikola pushes).

---

### Task 1: `Command` primitive in `@mr/ui` (on `cmdk`)

**Files:**
- Modify: `packages/ui/package.json` (add `cmdk` dependency)
- Create: `packages/ui/src/primitives/command.tsx`
- Modify: `packages/ui/src/index.ts` (export the new primitive)
- Test: `packages/ui/src/primitives/__tests__/command.test.tsx`

**Interfaces:**
- Produces: `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandSeparator` — re-exported from `@mr/ui`. `CommandDialog` props: `{ open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode; title: string; description?: string }` (title/description feed the existing `Dialog` for a11y; visually hidden).
- Consumes: the existing `@mr/ui` `Dialog`, `DialogContent` from `packages/ui/src/primitives/dialog.tsx`; `cn` from `@mr/ui`.

- [ ] **Step 1: Add the dependency**

In `packages/ui/package.json` add to `dependencies` (match the version cmdk resolves to in the workspace; `cmdk` peers on React 19-compatible):

```json
"cmdk": "^1.1.1"
```

Then install: `pnpm install` (do NOT interrupt).

- [ ] **Step 2: Write the failing test**

`packages/ui/src/primitives/__tests__/command.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../command.js'

function Harness() {
  return (
    <Command shouldFilter>
      <CommandInput placeholder="Search" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Group">
          <CommandItem value="apple">Apple</CommandItem>
          <CommandItem value="banana">Banana</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

describe('Command', () => {
  it('filters items as the user types', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search'), 'app')

    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.queryByText('Banana')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @mr/ui test -- command.test`
Expected: FAIL — cannot resolve `../command.js`.

- [ ] **Step 4: Write the primitive**

`packages/ui/src/primitives/command.tsx` (standard shadcn wrapper, adapted to house style — no semicolons, `mri`-agnostic neutral tokens since `@mr/ui` is app-neutral; use existing `mr-*` neutral tokens):

```tsx
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react'

import { cn } from '../lib/cn.js'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog.js'

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-md bg-mr-neutral-subtle text-mr-neutral-strong',
      className,
    )}
    {...props}
  />
))
Command.displayName = 'Command'

export interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
  title: string
  description?: string
}

export function CommandDialog({ open, onOpenChange, children, title, description }: CommandDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg sm:max-w-[560px]">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description !== undefined ? (
          <DialogDescription className="sr-only">{description}</DialogDescription>
        ) : null}
        <Command
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
          shouldFilter={false}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div className="flex items-center border-b border-mr-neutral px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-mr-neutral-strong/60 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = 'CommandInput'

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn('max-h-[360px] overflow-y-auto overflow-x-hidden', className)}
    {...props}
  />
))
CommandList.displayName = 'CommandList'

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
))
CommandEmpty.displayName = 'CommandEmpty'

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn('overflow-hidden p-1 text-mr-neutral-strong', className)}
    {...props}
  />
))
CommandGroup.displayName = 'CommandGroup'

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[selected=true]:bg-mr-neutral data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
))
CommandItem.displayName = 'CommandItem'

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator ref={ref} className={cn('-mx-1 h-px bg-mr-neutral', className)} {...props} />
))
CommandSeparator.displayName = 'CommandSeparator'
```

> NOTE for implementer: confirm the `cn` import path (`../lib/cn.js` vs wherever `dialog.tsx` imports it) and the exact neutral token names by matching `dialog.tsx`/`confirm-dialog.tsx`. Use whatever those already use — do not introduce new tokens.

- [ ] **Step 5: Export from the barrel**

In `packages/ui/src/index.ts`, near the `dialog` export block:

```ts
export {
  Command,
  CommandDialog,
  type CommandDialogProps,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from './primitives/command.js'
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter @mr/ui test -- command.test`
Expected: PASS.

- [ ] **Step 7: Build `@mr/ui` (so consumers see the new export)**

Run: `pnpm --filter @mr/ui build`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/package.json packages/ui/src/primitives/command.tsx packages/ui/src/primitives/__tests__/command.test.tsx packages/ui/src/index.ts pnpm-lock.yaml
git commit -m "feat(ui): add cmdk-based Command primitive"
```

---

### Task 2: Command registry + shared permission filter

**Files:**
- Modify: `apps/internal-web/src/config/navigation.ts` (extract `filterVisibleNavItems`; add three palette-only commands)
- Modify: `apps/internal-web/src/components/layout/internal-sidebar.tsx` (use the extracted helper)
- Create: `apps/internal-web/src/features/command-palette/command-registry.ts`
- Modify: Paraglide `sr` + `en` message catalogs (add the new keys — see other `nav_*` keys for location)
- Test: `apps/internal-web/src/features/command-palette/__tests__/command-registry.test.ts`

**Interfaces:**
- Consumes: `NavItem`, `internalNavItems` from `config/navigation.ts`; `emotive_claims.create` / `domace_claims.create` permission strings.
- Produces:
  - `filterVisibleNavItems(items: readonly NavItem[], userPermissions: readonly string[]): NavItem[]` in `navigation.ts`.
  - `commandPaletteNavItems: readonly NavItem[]` in `command-registry.ts` — `internalNavItems` plus `nova-emotive`, `nova-domace`, `bezbednost`.

- [ ] **Step 1: Write the failing test**

`apps/internal-web/src/features/command-palette/__tests__/command-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { filterVisibleNavItems } from '~/config/navigation'
import { commandPaletteNavItems } from '../command-registry'

describe('commandPaletteNavItems', () => {
  it('includes the create-claim and security commands', () => {
    const keys = commandPaletteNavItems.map((item) => item.key)
    expect(keys).toContain('nova-emotive')
    expect(keys).toContain('nova-domace')
    expect(keys).toContain('bezbednost')
  })
})

describe('filterVisibleNavItems', () => {
  it('hides a command whose single permission the user lacks', () => {
    const visible = filterVisibleNavItems(commandPaletteNavItems, [])
    expect(visible.map((i) => i.key)).not.toContain('nova-emotive')
    // ungated commands still show
    expect(visible.map((i) => i.key)).toContain('pocetna')
    expect(visible.map((i) => i.key)).toContain('bezbednost')
  })

  it('shows a command when the user has the required permission', () => {
    const visible = filterVisibleNavItems(commandPaletteNavItems, ['emotive_claims.create'])
    expect(visible.map((i) => i.key)).toContain('nova-emotive')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter internal-web test -- command-registry`
Expected: FAIL — `filterVisibleNavItems` / `command-registry` not found.

- [ ] **Step 3: Extract the filter into `navigation.ts`**

Append to `apps/internal-web/src/config/navigation.ts`:

```ts
function hasAnyPermission(userPermissions: readonly string[], required: readonly string[]): boolean {
  const permissionSet = new Set(userPermissions)
  return required.some((permission) => permissionSet.has(permission))
}

/** Filters nav items to those the user's permissions allow (ungated items always show). */
export function filterVisibleNavItems(
  items: readonly NavItem[],
  userPermissions: readonly string[],
): NavItem[] {
  return items.filter((item) => {
    if (item.permissions !== undefined) {
      return hasAnyPermission(userPermissions, item.permissions)
    }
    if (item.permission !== undefined) {
      return userPermissions.includes(item.permission)
    }
    return true
  })
}
```

- [ ] **Step 4: Use the helper in the sidebar (remove the duplicated inline filter)**

In `internal-sidebar.tsx`: delete the local `hasAnyPermission` function and the inline `const visibleItems = internalNavItems.filter(...)` block, replacing with:

```tsx
import { filterVisibleNavItems, internalNavItems } from '~/config/navigation'
// ...
const visibleItems = filterVisibleNavItems(internalNavItems, userPermissions)
```

- [ ] **Step 5: Add i18n keys**

Add to the `sr` catalog: `nav_nova_emotive` = "Nova EMOTIVE reklamacija", `nav_nova_domace` = "Nova DOMACE reklamacija", `command_palette_placeholder` = "Pretraži ili skoči…", `command_palette_empty` = "Nema rezultata.", `command_palette_group_navigation` = "Navigacija", `command_palette_group_claims` = "Reklamacije".
Add to `en` catalog: `nav_nova_emotive` = "New EMOTIVE claim", `nav_nova_domace` = "New DOMACE claim", `command_palette_placeholder` = "Search or jump to…", `command_palette_empty` = "No results.", `command_palette_group_navigation` = "Navigation", `command_palette_group_claims` = "Claims".
(Reuse existing `nav_pocetna`, `nav_pristiglo`, `nav_reklamacije`, `nav_statistika`, `nav_security`.)

- [ ] **Step 6: Create the registry**

`apps/internal-web/src/features/command-palette/command-registry.ts`:

```ts
import { m } from '@mr/i18n'
import { FilePlus2, Shield } from 'lucide-react'

import { internalNavItems, type NavItem } from '~/config/navigation'

const paletteExtraItems: readonly NavItem[] = [
  {
    key: 'nova-emotive',
    label: m.nav_nova_emotive,
    to: '/reklamacije/emotive/nova',
    icon: FilePlus2,
    permission: 'emotive_claims.create',
  },
  {
    key: 'nova-domace',
    label: m.nav_nova_domace,
    to: '/reklamacije/domace/nova',
    icon: FilePlus2,
    permission: 'domace_claims.create',
  },
  {
    key: 'bezbednost',
    label: m.nav_security,
    to: '/settings/security',
    icon: Shield,
  },
]

/** All navigation targets offered by the command palette (sidebar items + create/security). */
export const commandPaletteNavItems: readonly NavItem[] = [...internalNavItems, ...paletteExtraItems]
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm --filter internal-web test -- command-registry`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/internal-web/src/config/navigation.ts apps/internal-web/src/components/layout/internal-sidebar.tsx apps/internal-web/src/features/command-palette/ packages/i18n
git commit -m "feat(internal): command-palette nav registry + shared nav permission filter"
```

---

### Task 3: The palette component + mount in `_shell`

**Files:**
- Create: `apps/internal-web/src/features/command-palette/use-debounced-value.ts`
- Create: `apps/internal-web/src/features/command-palette/command-palette.tsx`
- Modify: `apps/internal-web/src/routes/_shell.tsx` (mount `<CommandPalette />` once)
- Test: `apps/internal-web/src/features/command-palette/__tests__/command-palette.test.tsx`

**Interfaces:**
- Consumes: `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem` from `@mr/ui`; `commandPaletteNavItems`, `filterVisibleNavItems`; `claimsListOptions` from `@mr/shared`; `useNavigate`, `getRouteApi` from `@tanstack/react-router`.
- Produces: `CommandPalette` (default-less named export) — self-contained, no props; reads permissions from `__root__` route context.

- [ ] **Step 1: Write the failing test**

`apps/internal-web/src/features/command-palette/__tests__/command-palette.test.tsx` — cover open-on-shortcut, permission filtering, and claim-result routing. Mock the route context, `useNavigate`, and `claimsListOptions`'s fetch. Skeleton:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const navigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
  getRouteApi: () => ({ useRouteContext: () => ({ authSession: { user: { permissions: ['emotive_claims.create'] } } }) }),
}))

// render CommandPalette inside a QueryClientProvider; see other internal-web
// feature tests (e.g. features/inbox/__tests__) for the provider harness.

describe('CommandPalette', () => {
  it('opens on Cmd/Ctrl+K and lists permitted nav commands', async () => {
    const user = userEvent.setup()
    // render harness...
    await user.keyboard('{Meta>}k{/Meta}')
    expect(screen.getByPlaceholderText(/skoči|jump/i)).toBeInTheDocument()
    expect(screen.getByText(/Nova EMOTIVE/i)).toBeInTheDocument()
  })

  it('routes to the emotive detail when a claim result is chosen', async () => {
    // seed claimsListOptions fetch mock to return one EMOTIVE item {kind:'emotive', id:'abc', mrNumber:'7167/25', customerName:'X'}
    // open, type '7167', click the result
    // expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ to: '/reklamacije/emotive/$id', params: { id: 'abc' } }))
  })
})
```

> Match the existing internal-web test harness (QueryClientProvider + `renderWithProviders` if present). Keep the mock of `claimsListOptions` at the `fetchJson`/network layer where other tests mock it — do not mock `@mr/shared` domain logic wholesale.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter internal-web test -- command-palette.test`
Expected: FAIL — `command-palette.tsx` not found.

- [ ] **Step 3: Debounce hook**

`apps/internal-web/src/features/command-palette/use-debounced-value.ts`:

```ts
import { useEffect, useState } from 'react'

/** Returns `value` delayed by `delayMs`; resets the timer on each change. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
```

- [ ] **Step 4: The palette component**

`apps/internal-web/src/features/command-palette/command-palette.tsx`:

```tsx
import { claimsListOptions } from '@mr/shared'
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
import { commandPaletteNavItems } from './command-registry'
import { useDebouncedValue } from './use-debounced-value'

const rootRoute = getRouteApi('__root__')
const SEARCH_MIN_CHARS = 2
const MAX_CLAIM_RESULTS = 6

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { authSession } = rootRoute.useRouteContext()
  const userPermissions = authSession?.user?.permissions ?? []

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const debouncedQuery = useDebouncedValue(query.trim(), 300)
  const searchEnabled = debouncedQuery.length >= SEARCH_MIN_CHARS

  const claimsQuery = useQuery({
    ...claimsListOptions({ search: debouncedQuery }, 1, 10),
    enabled: open && searchEnabled,
  })

  const navItems = useMemo(() => {
    const visible = filterVisibleNavItems(commandPaletteNavItems, userPermissions)
    const q = query.trim().toLowerCase()
    if (q.length === 0) {
      return visible
    }
    return visible.filter((item) => item.label().toLowerCase().includes(q))
  }, [userPermissions, query])

  const claimResults = (claimsQuery.data?.items ?? []).slice(0, MAX_CLAIM_RESULTS)

  function close() {
    setOpen(false)
    setQuery('')
  }

  function goTo(to: string) {
    close()
    navigate({ to })
  }

  function goToClaim(item: (typeof claimResults)[number]) {
    close()
    if (item.kind === 'emotive') {
      navigate({ to: '/reklamacije/emotive/$id', params: { id: item.id } })
      return
    }
    navigate({ to: '/reklamacije/domace/$id', params: { id: item.id } })
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title={m.command_palette_placeholder()}>
      <CommandInput
        placeholder={m.command_palette_placeholder()}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{m.command_palette_empty()}</CommandEmpty>

        {navItems.length > 0 ? (
          <CommandGroup heading={m.command_palette_group_navigation()}>
            {navItems.map((item) => (
              <CommandItem key={item.key} value={`nav-${item.key}`} onSelect={() => goTo(item.to)}>
                <item.icon className="size-4 flex-none opacity-70" aria-hidden="true" />
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
```

> NOTE: `CommandDialog`/`Command` uses `shouldFilter={false}` (Task 1), so cmdk shows exactly the items we render — nav filtering is manual (substring), claim results come from the server. `CommandItem.value` must be unique per item so keyboard selection works.

- [ ] **Step 5: Mount once in `_shell`**

In `apps/internal-web/src/routes/_shell.tsx`, import and render `<CommandPalette />` inside the shell layout (sibling to the sidebar/outlet, so it persists across navigations):

```tsx
import { CommandPalette } from '~/features/command-palette/command-palette'
// ...inside the shell's returned JSX, once:
<CommandPalette />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter internal-web test -- command-palette.test`
Expected: PASS.

- [ ] **Step 7: Full gate**

Run: `pnpm format:check && pnpm exec turbo run build typecheck lint test --force && pnpm --filter api depcruise && pnpm test:integration`
Expected: all exit 0.

- [ ] **Step 8: Commit**

```bash
git add apps/internal-web/src/features/command-palette/ apps/internal-web/src/routes/_shell.tsx
git commit -m "feat(internal): ⌘K command palette (nav + claim jump)"
```

---

## Self-Review

- **Spec coverage:** ⌘K/Esc toggle (T3 keydown) · empty nav list + typing filter (T3 navItems) · debounced claim search via `/api/claims?search=` (T3 useQuery) · kind-routed detail nav (T3 goToClaim) · permission-filtered nav reusing sidebar logic (T2 `filterVisibleNavItems`) · primitive in `@mr/ui`, feature in internal-web, mounted in `_shell` (T1/T3) · i18n sr+en parity (T2 Step 5) · no backend/migration/permission changes. ✓
- **Placeholders:** the two spots marked "NOTE for implementer" are reuse-confirmations (match existing token/import/test-harness names), not open design — acceptable per "follow existing patterns". No TBD/TODO code.
- **Type consistency:** `filterVisibleNavItems(items, userPermissions)` name identical across navigation.ts, sidebar, registry test, and palette. `commandPaletteNavItems` identical across registry, test, palette. `CommandDialogProps` matches usage in palette. `claim.kind` values `'emotive'`/`'domace'` match the `ClaimKind` discriminated union.
