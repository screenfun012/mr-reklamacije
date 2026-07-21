# Command palette (⌘K) — internal-web — Design

**Status:** approved (Nikola, 2026-07-21). Scope = internal-web only, v1.

## Goal

A ⌘K command palette for operators in `internal-web`: jump to any screen and
jump straight to any claim by typing. Power-user navigation, zero new backend.

## Behavior

- **⌘K** (Mac) / **Ctrl+K** (Win/Linux) opens the palette anywhere in the app;
  **Esc** closes. Opening is a pure client interaction — no route change.
- **Empty (before typing):** a list of navigation commands (grouped "Navigacija").
- **While typing** — two things at once:
  - `cmdk` fuzzy-filters the navigation commands locally, and
  - **live claim search** (debounced 300 ms) via the existing
    `GET /api/claims?search=<q>` (unified FTS over MR number / warranty / customer),
    shown as a second group "Reklamacije", top 6 results.
- **Enter on a claim result** → navigate to its detail, routed by `kind`:
  EMOTIVE → `/reklamacije/emotive/$id`, DOMACE → `/reklamacije/domace/$id`.
  `kind` comes from the API item, never inferred.
- **Enter on a navigation command** → navigate to that route.
- Selecting anything closes the palette and clears the query.

### Navigation commands (real, existing routes)

Reuse the existing sidebar registry `internalNavItems`
(`apps/internal-web/src/config/navigation.ts`) for the shared ones, plus three
palette-only extras. Each carries an optional `permission` / `permissions`:

| Command | Route | Permission gate |
| --- | --- | --- |
| Početna | `/` | — |
| Pristiglo | `/pristiglo` | `client_submissions.manage` |
| Reklamacije | `/reklamacije` | any of `CLAIMS_LIST_VIEW_PERMISSIONS` |
| Statistika | `/statistika` | — |
| Nova EMOTIVE reklamacija | `/reklamacije/emotive/nova` | `emotive_claims.create` |
| Nova DOMACE reklamacija | `/reklamacije/domace/nova` | `domace_claims.create` |
| Bezbednost | `/settings/security` | — |

## Permissions — palette bypasses nothing

- **Navigation commands** are filtered by the user's permissions using the SAME
  logic the sidebar already uses (`hasAnyPermission` + the `permission` /
  `permissions` fields). That inline filter is **extracted** from the sidebar
  into a shared helper `filterVisibleNavItems(items, userPermissions)` in
  `navigation.ts`, and both sidebar and palette call it (no duplication).
- User permissions are read from the route context
  (`rootRoute.useRouteContext().authSession?.user?.permissions`), exactly as the
  sidebar reads them.
- **Claim search** returns only claims the API already scopes for the caller
  (viewer/operator) — the palette adds no new access. Server stays the judge.

## Where it lives

- Mounted **once** in the `_shell` layout route
  (`apps/internal-web/src/routes/_shell.tsx`) so it survives navigations (same
  place the SSE stream lives). A global `keydown` listener toggles open state.
- **`Command` primitive** (shadcn, on top of `cmdk`) goes in `@mr/ui`
  (`packages/ui/src/primitives/command.tsx`), alongside the existing `dialog`
  primitive — `CommandDialog` composes the existing `@mr/ui` `Dialog`. Exported
  from the `@mr/ui` barrel. Editing `@mr/ui` requires the rebuild-and-restart
  procedure in CLAUDE.md §4.
- The **palette feature** (command definitions, keybinding, claim-search wiring)
  lives in `apps/internal-web/src/features/command-palette/`.

## Reuse (nothing new invented)

- `GET /api/claims?search=` — already exists (`search` is on
  `ClaimListQuerySchema`), FTS-indexed. Consumed via `claimsListOptions({ search },
  1, 10)` from `@mr/shared` (`ClaimsListFilters` includes `search`).
- `ClaimListItem` discriminated union (`kind`, `id`, `mrNumber`, `customerName`,
  `outcome`) supplies everything the result row renders.
- `internalNavItems`, `hasAnyPermission`, route-context permissions — reused.

## Cost / risk

Adds only the `cmdk` dependency. **No new endpoints, no migrations, no new
permissions, no auth changes, no Railway cost.**

## Out of scope for v1 (YAGNI — add later if needed)

- Quick actions (change-outcome etc.) — "Nova reklamacija" is already a nav command.
- Recent/frequent history.
- Palette in admin-web / portal (hoist the `@mr/ui` primitive when a second app needs it).
- User / audit search.

## Testing

- `@mr/ui` `command.tsx`: renders, typing filters items (primitive test).
- Palette: opens on ⌘K, closes on Esc; navigation group filtered by permissions
  (item hidden without permission); debounced claim search renders results;
  Enter on a claim routes to the correct detail path by `kind`; Enter on a nav
  command routes to its route.
