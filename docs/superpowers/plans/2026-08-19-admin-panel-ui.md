# Admin panel UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin panel internal-web's visual language — cards, a list header, icon row actions, rhythm — and turn its dashboard from four numbers into a screen that says what needs doing.

**Architecture:** Nothing new is designed. internal-web's measurements are copied verbatim through the shared `mr-*` tokens admin already uses. Eight of thirteen screens go through one shared component (`ResourceListPage`), so the bulk lands in one file. The dashboard renders fields the server already sends and admin already fetches; only the "who causes the most faults" card needs new server work, and it gets its own 5-row projection rather than calling the 11-query statistics endpoint.

**Tech Stack:** TanStack Start (React 19, SSR) · TanStack Query · Tailwind v4 + `@mr/tailwind-preset` · shadcn via `@mr/ui` · lucide-react · Hono + Drizzle (Task 6 only) · Vitest.

**Spec:** `docs/superpowers/specs/2026-08-19-admin-panel-ui-design.md`

## Global Constraints

- **Colours only via `mr-*` tokens.** Never a raw Tailwind palette colour, never `bg-[#…]`. Opacity modifiers on a token (`bg-mr-brand/10`) are correct; a literal `rgba()` is not.
- **Every user string through Paraglide `m.*`**, keys in BOTH `sr.json` and `en.json` (CI checks parity). **No ICU plurals** — they crash this repo's Paraglide compile. Phrase counts so no grammatical form depends on the number: `Ukupno: 12`, never `{count} stavki`.
- After editing `packages/i18n/src/messages/*.json`: `pnpm --filter @mr/i18n run compile` for dev, and `pnpm --filter @mr/i18n run build` before typecheck — a NEW key typechecks red until the package is built.
- **Do not touch `buttonVariants` in `@mr/ui`.** Brand red as the default is a three-app brandbook decision and is Nikola's, not this plan's.
- **No migration, no new permission, no change to what any screen does.**
- Full gate before every commit, split, under `TZ=UTC`:
  ```bash
  pnpm format:check \
    && TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=4 \
    && TZ=UTC pnpm exec turbo run test --force --concurrency=2 \
    && pnpm --filter api depcruise && TZ=UTC pnpm test:integration
  ```
- **The gate does not see the screen.** Every task that changes a screen ends with that screen opened in the browser, in both themes and both locales. On 2026-08-19 the gate was green while badges were light-on-black, the dashboard printed its own name twice, and the roles list re-fetched twice a minute.
- **Never start or kill the dev servers.** `pnpm dev:all` is Nikola's terminal.

---

### Task 1: The card primitives both halves need

`@mr/ui` already exports a `dataTable*` family (`dataTableCardClassName`, `dataTableHeadRowClassName`, …). It has no card **header** and no panel for anything that is not a table, which is what the filter block and every dashboard card need.

**Files:**

- Modify: `packages/ui/src/lib/field-control-styles.ts` (append; the `dataTable*` family lives here)
- Modify: `packages/ui/src/index.ts` (export the new names next to `dataTableCardClassName`)
- Test: `packages/ui/src/lib/__tests__/field-control-styles.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `panelClassName`, `panelHeaderClassName`, `panelTitleClassName`, `panelMetaClassName` — all `string` constants, all exported from `@mr/ui`.

- [ ] **Step 1: Write the failing test**

Append to `packages/ui/src/lib/__tests__/field-control-styles.test.ts`:

```ts
describe('panel classes', () => {
  // The panel is the one shape every admin screen was missing: internal-web wraps filters, lists
  // and dashboard blocks in it, admin wrapped only tables. Same radius and border as
  // `dataTableCardClassName`, so a filter card and the list under it line up.
  it('shares its radius and border with the data-table card', () => {
    expect(panelClassName).toContain('rounded-[14px]')
    expect(dataTableCardClassName).toContain('rounded-[14px]')
    expect(panelClassName).toContain('border-border')
  })

  it('paints the panel on the card surface, not the page', () => {
    expect(panelClassName).toContain('bg-card')
  })

  it('separates the header from the body with a rule', () => {
    expect(panelHeaderClassName).toContain('border-b')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
TZ=UTC pnpm --filter @mr/ui exec vitest run src/lib/__tests__/field-control-styles.test.ts
```

Expected: FAIL — `panelClassName is not defined`.

- [ ] **Step 3: Add the constants**

Append to `packages/ui/src/lib/field-control-styles.ts`:

```ts
/**
 * The block every admin screen sits in. internal-web wraps its filters, its list and every
 * dashboard section in this shape; admin wrapped only tables, which is most of why its screens read
 * as loose rows on a page rather than as a screen.
 *
 * Same radius and border as `dataTableCardClassName` on purpose — a filter panel and the list panel
 * below it have to line up down the edge.
 */
export const panelClassName = 'rounded-[14px] border border-border bg-card'

/** Title row of a panel: name on the left, a count or an action on the right. */
export const panelHeaderClassName =
  'flex items-center justify-between gap-3 border-b border-border px-5 py-4'

export const panelTitleClassName = 'text-[15px] font-extrabold text-foreground'

/** The quiet figure beside a panel title — a count, a range, a timestamp. */
export const panelMetaClassName = 'font-mono text-[11px] text-muted-foreground'
```

Then in `packages/ui/src/index.ts`, add to the existing export block that already lists `dataTableCardClassName`:

```ts
  panelClassName,
  panelHeaderClassName,
  panelMetaClassName,
  panelTitleClassName,
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
TZ=UTC pnpm --filter @mr/ui exec vitest run src/lib/__tests__/field-control-styles.test.ts
```

Expected: PASS.

- [ ] **Step 5: Prove the test bites**

Change `panelClassName` to `'rounded-lg border border-border bg-card'` and re-run. Expected: FAIL on the radius assertion. Put `rounded-[14px]` back.

- [ ] **Step 6: Full gate, then commit**

```bash
pnpm --filter @mr/ui build
git add packages/ui/src/lib/field-control-styles.ts packages/ui/src/lib/__tests__/field-control-styles.test.ts packages/ui/src/index.ts
git commit -m "feat(ui): the panel shape every admin screen was missing"
```

---

### Task 2: Filters and list get their panels (eight screens at once)

**Files:**

- Modify: `apps/admin-web/src/lib/resource/resource-list-page.tsx`
- Modify: `apps/admin-web/src/lib/resource/resource-list-toolbar.tsx:97` (the outer `<div>` only)
- Modify: `apps/admin-web/src/lib/resource/resource-table.tsx` (wrap in the panel header)
- Modify: `packages/i18n/src/messages/sr.json`, `packages/i18n/src/messages/en.json`
- Test: browser (no logic changes)

**Interfaces:**

- Consumes: `panelClassName`, `panelHeaderClassName`, `panelTitleClassName`, `panelMetaClassName` from Task 1.
- Produces: nothing new. `ResourceListPage`'s props are unchanged, so all eight catalogue routes are untouched.

- [ ] **Step 1: Add the count label**

In BOTH `packages/i18n/src/messages/sr.json` and `en.json`, add (keys stay alphabetically sorted):

```json
"admin_catalog_count_total": "Ukupno: {total}",
"admin_catalog_list_title": "Spisak"
```

```json
"admin_catalog_count_total": "Total: {total}",
"admin_catalog_list_title": "List"
```

⚠ Phrased with a colon deliberately. `{total} stavki` reads "1 stavki" in Serbian, and this repo cannot use ICU plurals to fix it.

```bash
pnpm --filter @mr/i18n run compile && pnpm --filter @mr/i18n run build
```

- [ ] **Step 2: Give the toolbar its panel**

In `apps/admin-web/src/lib/resource/resource-list-toolbar.tsx`, the outer element of `ResourceListToolbar` becomes:

```tsx
    <div
      className={`${panelClassName} flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between`}
    >
```

Add `panelClassName` to the `@mr/ui` import.

- [ ] **Step 3: Give the table its header**

In `apps/admin-web/src/lib/resource/resource-table.tsx`, the element currently reading `<div className={dataTableCardClassName}>` becomes:

```tsx
      <div className={dataTableCardClassName}>
        <div className={panelHeaderClassName}>
          <h2 className={panelTitleClassName}>{m.admin_catalog_list_title()}</h2>
          <span className={panelMetaClassName}>{m.admin_catalog_count_total({ total })}</span>
        </div>
        <div className="overflow-x-auto">
```

⚠ **Not `definition.title()`.** `ResourceListPage` already renders it as the page `<h1>`, so reusing
it here would print "Odeljenja" twice on one screen — the exact fault found on the admin dashboard on
19.08. and fixed in `c52d83d`. internal-web has the same split: the page says "Reklamacije" and the
card says "Lista reklamacija". A generic "Spisak" serves all eight catalogues without eight new keys.

`ResourceTable` does not receive `total` today. Add it to its props and pass `paged.total` from `ResourceListPage`:

```tsx
      <ResourceTable
        definition={definition}
        items={paged.items}
        total={paged.total}
        onEdit={setEditTarget}
        onToggleActive={setToggleActiveTarget}
        {...(definition.lifecycle ? { onHardDelete: setHardDeleteTarget } : {})}
      />
```

⚠ `paged.total`, not `items.length` — the count belongs to the whole filtered set, not to the page being shown. `paginateClientList` already returns it.

- [ ] **Step 4: Keep the card when the list is empty**

`ResourceTable` returns early when `items.length === 0`, rendering a bare dashed panel. Leave that
branch for a catalogue that is genuinely empty, but a search filtered down to nothing must NOT make
the whole card disappear — the screen then reads as broken rather than as "no matches". Move the
early return inside the card so the header and its `Ukupno: 0` survive:

```tsx
      <div className={dataTableCardClassName}>
        <div className={panelHeaderClassName}>
          <h2 className={panelTitleClassName}>{m.admin_catalog_list_title()}</h2>
          <span className={panelMetaClassName}>{m.admin_catalog_count_total({ total })}</span>
        </div>
        {items.length === 0 ? (
          <div className="px-5 py-12 text-center" role="status">
            <p className="text-sm text-muted-foreground">{definition.emptyLabel()}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">{/* the existing table */}</div>
        )}
```

`dataTableEmptyClassName` stays exported and in use by other screens; it is simply no longer this
component's whole output.

- [ ] **Step 5: Move pagination inside the card**

In `apps/admin-web/src/lib/resource/resource-list-page.tsx`, `<ListPagination …/>` currently sits as a sibling after `<ResourceTable>`. Move it inside the card by rendering it from `ResourceTable`'s footer slot — add an optional `footer?: ReactNode` prop to `ResourceTable`, rendered last inside `dataTableCardClassName` with a top rule:

```tsx
        {footer === undefined ? null : (
          <div className="border-t border-border px-5 py-3">{footer}</div>
        )}
```

and in `ResourceListPage`:

```tsx
        footer={
          listConfig ? (
            <ListPagination
              total={paged.total}
              page={paged.page}
              pageSize={paged.pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          ) : undefined
        }
```

- [ ] **Step 6: Gate**

```bash
pnpm format:write && pnpm format:check \
  && TZ=UTC pnpm exec turbo run build typecheck lint --force --concurrency=4 \
  && TZ=UTC pnpm exec turbo run test --force --concurrency=2
```

- [ ] **Step 7: Look at it**

Open `http://localhost:3001/settings/departments` and `http://localhost:3001/settings/engine-types` (the one with the extra manufacturer filter), in **dark and light**, **SR and EN**. Check: filters sit in their own panel; the list panel has a title and `Ukupno: 13`; pagination is inside the card; nothing overflows horizontally.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web/src/lib/resource packages/i18n/src/messages
git commit -m "feat(admin): filters and list each get the panel internal-web has always had"
```

---

### Task 3: Row actions become icons

Thirteen solid red "Deaktiviraj" buttons down one column is the single loudest thing the panel does, and it is why red stopped meaning anything.

**Files:**

- Modify: `apps/admin-web/src/lib/resource/resource-table.tsx`
- Create: `apps/admin-web/src/lib/resource/__tests__/resource-row-actions.test.tsx`

**Interfaces:**

- Consumes: `dataTableIconActionClassName` (already exported from `@mr/ui`).
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the failing test**

Create `apps/admin-web/src/lib/resource/__tests__/resource-row-actions.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ResourceRowActions } from '../resource-row-actions'

const ITEM = { id: 'a', isActive: true }

describe('ResourceRowActions', () => {
  // An icon without a name is a puzzle for whoever sees the screen first. Both are set, and the
  // accessible name is what the test reads — a `title` alone is invisible to a screen reader.
  it('names every icon action', () => {
    render(
      <ResourceRowActions
        item={ITEM}
        editLabel="Izmeni"
        deactivateLabel="Deaktiviraj"
        activateLabel="Aktiviraj"
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Izmeni' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deaktiviraj' })).toBeInTheDocument()
  })

  // The same control does both jobs, so its name has to follow the row's state or it lies.
  it('names the toggle for what it will DO, not for what the row is', () => {
    render(
      <ResourceRowActions
        item={{ id: 'a', isActive: false }}
        editLabel="Izmeni"
        deactivateLabel="Deaktiviraj"
        activateLabel="Aktiviraj"
        onEdit={() => undefined}
        onToggleActive={() => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Aktiviraj' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deaktiviraj' })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
TZ=UTC pnpm --filter admin-web exec vitest run src/lib/resource/__tests__/resource-row-actions.test.tsx
```

Expected: FAIL — cannot resolve `../resource-row-actions`.

- [ ] **Step 3: Write the component**

Create `apps/admin-web/src/lib/resource/resource-row-actions.tsx`:

```tsx
import { dataTableIconActionClassName } from '@mr/ui'
import { Pencil, Power } from 'lucide-react'
import type { ReactElement } from 'react'

export interface ResourceRowActionsProps<TItem extends { id: string; isActive: boolean }> {
  item: TItem
  editLabel: string
  deactivateLabel: string
  activateLabel: string
  onEdit: (item: TItem) => void
  onToggleActive: (item: TItem) => void
}

/**
 * Icons, not text buttons. Every catalogue row carried a full brand-red "Deaktiviraj" and a
 * red-outlined "Izmeni", so a thirteen-row screen was a column of red — which is how a colour stops
 * meaning anything. internal-web has used icon actions from the start.
 *
 * Nothing hides behind a "…" menu: three actions fit in a row, and a hidden action is one nobody
 * finds.
 */
export function ResourceRowActions<TItem extends { id: string; isActive: boolean }>({
  item,
  editLabel,
  deactivateLabel,
  activateLabel,
  onEdit,
  onToggleActive,
}: ResourceRowActionsProps<TItem>): ReactElement {
  // Named for what the click WILL do. Naming it after the row's current state ("Aktivan") would
  // make the control describe the row instead of the action, which is the classic toggle lie.
  const toggleLabel = item.isActive ? deactivateLabel : activateLabel

  return (
    <>
      <button
        type="button"
        title={editLabel}
        aria-label={editLabel}
        className={dataTableIconActionClassName}
        onClick={() => {
          onEdit(item)
        }}
      >
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        title={toggleLabel}
        aria-label={toggleLabel}
        className={dataTableIconActionClassName}
        onClick={() => {
          onToggleActive(item)
        }}
      >
        <Power className="size-4" aria-hidden="true" />
      </button>
    </>
  )
}
```

- [ ] **Step 4: Run the test and watch it pass**

```bash
TZ=UTC pnpm --filter admin-web exec vitest run src/lib/resource/__tests__/resource-row-actions.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Prove the test bites**

Replace `const toggleLabel = item.isActive ? deactivateLabel : activateLabel` with `const toggleLabel = deactivateLabel` and re-run. Expected: the second test FAILS. Put it back.

- [ ] **Step 6: Use it in the table**

In `apps/admin-web/src/lib/resource/resource-table.tsx`, replace the two `<Button>` elements for edit and toggle-active with `<ResourceRowActions … />`, keeping the existing hard-delete icon and its tooltip untouched. The labels come from the definition exactly as they do today (`definition.editActionLabel()` and the lifecycle labels).

- [ ] **Step 7: Gate and look at it**

Full gate, then open `http://localhost:3001/settings/departments` in both themes. Check: no red column; hovering each icon shows its name; the delete icon still refuses with its tooltip on a row in use.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web/src/lib/resource
git commit -m "feat(admin): row actions become icons, and red goes back to meaning something"
```

---

### Task 4: The five screens that are not catalogues

Korisnici, Revizija, Ovlašćenja, Podešavanja, Bezbednost each render their own markup. They get the same panel shape by hand.

**Files:**

- Modify: `apps/admin-web/src/components/users/users-page.tsx`
- Modify: `apps/admin-web/src/components/audit/audit-page.tsx`
- Modify: `apps/admin-web/src/components/roles/roles-screen.tsx`
- Modify: `apps/admin-web/src/components/app-settings/app-settings-form.tsx`
- Modify: `apps/admin-web/src/routes/_shell/settings/security.tsx`

**Interfaces:**

- Consumes: `panelClassName`, `panelHeaderClassName`, `panelTitleClassName`, `panelMetaClassName` (Task 1); `dataTableCardClassName` and family (already shipped).
- Produces: nothing.

- [ ] **Step 1: Roles screen**

`roles-screen.tsx` already uses `dataTableCardClassName`. Add the header inside it, above `<div className="overflow-x-auto">`:

```tsx
          <div className={panelHeaderClassName}>
            <h2 className={panelTitleClassName}>{m.roles_title()}</h2>
            <span className={panelMetaClassName}>
              {m.admin_catalog_count_total({ total: roles.length })}
            </span>
          </div>
```

- [ ] **Step 2: Users screen**

`users-page.tsx` renders two sections ("Pending requests", "All users") as a bare `<h2>` over a bare
table. Each becomes one card, and the loose `<h2>` above it is deleted — the panel header replaces
it, it does not join it:

```tsx
<div className={dataTableCardClassName}>
  <div className={panelHeaderClassName}>
    <h2 className={panelTitleClassName}>{m.users_pending_title()}</h2>
    <span className={panelMetaClassName}>
      {m.admin_catalog_count_total({ total: pendingUsers.length })}
    </span>
  </div>
  <div className="overflow-x-auto">{/* the existing <table>, unchanged */}</div>
</div>
```

The "All users" card is the same shape with `m.users_all_title()` and `users.length`. The search
input that currently floats beside "All users" moves into that card's header, on the right, in place
of the count.

- [ ] **Step 3: Audit screen**

`audit-page.tsx` renders its filters loose and its table loose. Two wrappers, the same as Task 2 gave
every catalogue:

```tsx
<div className={`${panelClassName} flex flex-col gap-3 p-5 lg:flex-row lg:items-center`}>
  {/* the existing AuditLogFilters, unchanged */}
</div>

<div className={dataTableCardClassName}>
  <div className={panelHeaderClassName}>
    <h2 className={panelTitleClassName}>{m.nav_audit()}</h2>
  </div>
  <div className="overflow-x-auto">{/* the existing table, unchanged */}</div>
</div>
```

⚠ No count in this header. The audit list is an infinite query (`ensureInfiniteQueryData`) — it
knows how many rows it has PULLED, not how many exist, and a number that grows as you scroll is
worse than no number.

- [ ] **Step 4: App settings and Security**

Both are forms, not lists, so the panel carries a group of fields instead of a table:

```tsx
<section className={panelClassName}>
  <div className={panelHeaderClassName}>
    <h2 className={panelTitleClassName}>{m.settings_app_section_email()}</h2>
  </div>
  <div className="flex flex-col gap-4 p-5">{/* the existing fields, unchanged */}</div>
</section>
```

One section per group that already has a heading in the file. No field moves, no label changes, no
behaviour changes — if a group has no heading today, it does not gain one here.

- [ ] **Step 5: Gate and look at all five**

Full gate, then open each of `/users`, `/audit`, `/settings/roles`, `/settings/app`, `/settings/security` in dark and light, SR and EN.

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src
git commit -m "feat(admin): the five screens that are not catalogues get the same shape"
```

---

### Task 5: The dashboard renders what it already fetches

**Files:**

- Modify: `apps/admin-web/src/routes/_shell/index.tsx`
- Create: `apps/admin-web/src/components/dashboard/needs-you-card.tsx`
- Create: `apps/admin-web/src/components/dashboard/recent-changes-card.tsx`
- Create: `apps/admin-web/src/components/dashboard/__tests__/needs-you-card.test.tsx`
- Modify: `packages/i18n/src/messages/sr.json`, `en.json`

**Interfaces:**

- Consumes: `panelClassName`/`panelHeaderClassName`/`panelTitleClassName` (Task 1); `dashboardSummaryOptions()` and `usersListOptions()` — **both already in this route's loader**; `auditLogListOptions({})` — **not yet in this loader, add it**.
- Produces: `NeedsYouCard`, `RecentChangesCard` — used only by this route.

- [ ] **Step 1: Write the failing test**

Create `apps/admin-web/src/components/dashboard/__tests__/needs-you-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NeedsYouCard } from '../needs-you-card'

describe('NeedsYouCard', () => {
  // The point of the card is that an empty one is GOOD NEWS and has to read that way. A blank
  // panel reads as broken.
  it('says the queue is clear rather than rendering nothing', () => {
    render(<NeedsYouCard pendingUsers={[]} />)

    expect(screen.getByText('Nema naloga na čekanju.')).toBeInTheDocument()
  })

  it('names each waiting person', () => {
    render(
      <NeedsYouCard
        pendingUsers={[{ id: '1', name: 'Pera Perić', email: 'pera@test.rs' }]}
      />,
    )

    expect(screen.getByText('Pera Perić')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

```bash
TZ=UTC pnpm --filter admin-web exec vitest run src/components/dashboard/__tests__/needs-you-card.test.tsx
```

Expected: FAIL — cannot resolve `../needs-you-card`.

- [ ] **Step 3: Add the copy**

In BOTH message catalogues:

```json
"admin_dashboard_needs_you": "Traži tebe",
"admin_dashboard_needs_you_empty": "Nema naloga na čekanju.",
"admin_dashboard_recent_changes": "Poslednje promene",
"admin_dashboard_recent_changes_empty": "Još nema zabeleženih promena."
```

(EN: `"Needs you"`, `"No accounts are waiting."`, `"Latest changes"`, `"No changes recorded yet."`)

```bash
pnpm --filter @mr/i18n run compile && pnpm --filter @mr/i18n run build
```

- [ ] **Step 4: Write the cards**

`needs-you-card.tsx`:

```tsx
export interface NeedsYouCardProps {
  /** Only the three fields the card shows, so a test does not have to build a whole UserListItem. */
  pendingUsers: readonly { id: string; name: string; email: string }[]
}

export function NeedsYouCard({ pendingUsers }: NeedsYouCardProps): ReactElement {
  return (
    <section className={panelClassName}>
      <div className={panelHeaderClassName}>
        <h2 className={panelTitleClassName}>{m.admin_dashboard_needs_you()}</h2>
        <span className={panelMetaClassName}>
          {m.admin_catalog_count_total({ total: pendingUsers.length })}
        </span>
      </div>
      <div className="flex flex-col p-5">
        {pendingUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{m.admin_dashboard_needs_you_empty()}</p>
        ) : (
          pendingUsers.map((user) => (
            <Link
              key={user.id}
              to="/users"
              className="flex flex-col rounded-md px-2 py-2 transition-colors hover:bg-accent"
            >
              <span className="text-sm font-medium text-foreground">{user.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{user.email}</span>
            </Link>
          ))
        )}
      </div>
    </section>
  )
}
```

The route supplies the filter from the users list it already fetches:
`users.filter((user) => user.accountStatus === UserAccountStatus.Pending)`.

`recent-changes-card.tsx` is the same shape with `m.admin_dashboard_recent_changes()` as its title,
no count in the header (see Task 4 step 3 — an infinite query cannot honestly count), and a body of
the first six audit rows rendered as `actor · action · entity` with
`m.admin_dashboard_recent_changes_empty()` when there are none.

- [ ] **Step 5: Run the test and watch it pass, then prove it bites**

```bash
TZ=UTC pnpm --filter admin-web exec vitest run src/components/dashboard/__tests__/needs-you-card.test.tsx
```

Then delete the empty-state branch and re-run: expected FAIL on the first test. Put it back.

- [ ] **Step 6: Lay out the dashboard**

In `apps/admin-web/src/routes/_shell/index.tsx`: add `auditLogListOptions({})` to the loader's `Promise.all`, then render, in order — the existing stat row, a two-column grid holding `NeedsYouCard` and `RecentChangesCard`, and below it a panel holding the claims-per-month chart from `summary.chart`.

⚠ Import the chart **lazily** (`React.lazy`), the way internal-web does with `LazyDashboardClaimsChart` — recharts was deliberately split out of the internal entry bundle (269→143 KB gz) and pulling it into admin's eagerly would undo that on a second app.

- [ ] **Step 7: Gate and look at it**

Full gate, then open `http://localhost:3001/` in dark and light, SR and EN. Check the empty states by looking at a dashboard whose pending queue is genuinely zero.

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web/src packages/i18n/src/messages
git commit -m "feat(admin): the dashboard renders the four fields it was already fetching and discarding"
```

---

### Task 6: "Who causes the most faults"

**Files:**

- Modify: `packages/shared/src/schemas/dashboard.schema.ts`
- Modify: `apps/api/src/modules/dashboard/dashboard.repository.ts`
- Modify: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Modify: `apps/api/src/modules/dashboard/dashboard.controller.ts` (pass the actor's permissions, as `users.controller.ts` already does for `updateAccountStatus`)
- Create: `apps/admin-web/src/components/dashboard/top-faults-card.tsx`
- Modify: `apps/api/src/modules/dashboard/__tests__/dashboard.integration.test.ts`

**Interfaces:**

- Consumes: `panelClassName` family (Task 1).
- Produces: `DashboardSummary.topFaultEmployees: Array<{ employeeId: string; name: string; faultCount: number }> | null` — `null` for a reader without `employees.view_analytics`.

- [ ] **Step 1: Write the failing integration test**

Add to `apps/api/src/modules/dashboard/__tests__/dashboard.integration.test.ts`:

```ts
it('withholds named blame from a reader without employees.view_analytics', async () => {
  // How often a NAMED person was blamed is exactly what that permission protects. An empty array
  // would be a statement about the shop; `null` is a statement about the reader.
  const app = createDashboardTestApp(container, testUser(['emotive_claims.view', 'domace_claims.view']))

  const response = await app.request('/api/dashboard/summary')
  expect(response.status).toBe(200)

  const body = (await response.json()) as { topFaultEmployees: unknown }
  expect(body.topFaultEmployees).toBeNull()
})

it('returns at most five workers, most-blamed first, for a reader who may see them', async () => {
  const app = createDashboardTestApp(
    container,
    testUser(['emotive_claims.view', 'domace_claims.view', 'employees.view_analytics']),
  )

  const response = await app.request('/api/dashboard/summary')
  const body = (await response.json()) as {
    topFaultEmployees: { name: string; faultCount: number }[]
  }

  expect(body.topFaultEmployees.length).toBeLessThanOrEqual(5)
  for (let i = 1; i < body.topFaultEmployees.length; i += 1) {
    expect(body.topFaultEmployees[i - 1]!.faultCount).toBeGreaterThanOrEqual(
      body.topFaultEmployees[i]!.faultCount,
    )
  }
})
```

- [ ] **Step 2: Run and watch it fail**

```bash
TZ=UTC pnpm --filter api exec vitest run --config vitest.integration.config.ts src/modules/dashboard
```

Expected: FAIL — `topFaultEmployees` is `undefined`.

- [ ] **Step 3: Schema**

In `packages/shared/src/schemas/dashboard.schema.ts`, add to `DashboardSummarySchema`:

```ts
  /**
   * `null` for a reader without `employees.view_analytics`, exactly as `StatisticsByFaults.byEmployee`
   * behaves. An empty array would say "nobody was blamed for anything", which is a claim about the
   * shop and not about the reader.
   */
  topFaultEmployees: z
    .array(
      z.object({
        employeeId: z.string().uuid(),
        name: z.string(),
        faultCount: z.number().int().nonnegative(),
      }),
    )
    .nullable(),
```

- [ ] **Step 4: Repository**

Add one method to `dashboard.repository.ts` — a single `UNION ALL` over both fault tables, grouped by employee, ordered by count, `LIMIT 5`. Both `employee_id` columns are indexed (migration `0018`).

⚠ Do **not** call `StatisticsRepository`. A module may not import another module, and `/api/statistics/summary` runs eleven parallel queries to produce what this needs in one.

- [ ] **Step 5: Service and controller**

The service takes the actor's permissions and returns `null` when `employees.view_analytics` is absent — the check lives in the service, not the controller, so a direct call is gated too (`rules/07`: audit and gates in the service layer).

- [ ] **Step 6: Run the tests and watch them pass, then prove they bite**

Remove the permission check in the service and re-run: expected FAIL on the first test. Put it back.

- [ ] **Step 7: The card**

`top-faults-card.tsx` renders a panel titled "Ko najviše greši" listing name + count, and **renders nothing at all when the field is `null`** — not an empty state, since "you may not see this" is not news the screen should announce.

⚠ Label the figure as a **count**, not a rate. `employee_monthly_output` exists since migration `0004` and the Excel export already divides by it, but nothing ever writes it — so any percentage here would be computed against zero.

- [ ] **Step 8: Gate, look at it, commit**

```bash
git add apps/api/src/modules/dashboard packages/shared/src/schemas/dashboard.schema.ts apps/admin-web/src/components/dashboard packages/i18n/src/messages
git commit -m "feat(admin): the dashboard names who is blamed most, without paying for the whole statistics endpoint"
```

---

## Done when

- All six tasks committed, full gate green under `TZ=UTC` on each.
- Every admin screen opened in dark and light, SR and EN.
- No migration, no new permission, no change to what any screen does.
