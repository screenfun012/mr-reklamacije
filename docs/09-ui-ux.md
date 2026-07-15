# 09 — UI / UX Guidelines

The application must feel modern, fast, and obvious. Non-technical users
(employees and clients) should never wonder what to do.

## Core principles

1. **One primary action per screen.** The user always knows what "save this" or
   "go to next step" means.
2. **Destructive actions require confirmation.** Delete, archive, status change —
   always a dialog.
3. **Never lose the user's work.** Form autosave drafts to localStorage; warn before
   navigate-away on dirty forms.
4. **Loading never blocks the shell.** Sidebar + top bar are always interactive;
   only the content area shows spinners.
5. **Errors are human-readable.** Never show raw stack traces or error codes to users;
   always a friendly message with "Contact admin if this persists" affordance.
6. **Keyboard-first.** Every common workflow must be completable without a mouse.
7. **Mobile-responsive, not mobile-first.** Desktop is the primary target; mobile
   must work but can be minimal.

---

## Stack

- **CSS:** Tailwind CSS v4 (via `@mr/tailwind-preset`)
- **Components:** shadcn/ui as base layer, customized in `packages/ui/`
- **Icons:** `lucide-react` exclusively (consistent style, tree-shakeable)
- **Fonts:** Figtree Variable via `@fontsource-variable/figtree`; monospace `JetBrains Mono` for code/IDs. See **`docs/15-brand-guidelines.md`** for the full type scale.
- **Charts:** `recharts` (aligns with shadcn, sufficient for our stats needs)
- **Date picker:** shadcn's `Calendar` based on `react-day-picker`
- **Tables:** `@tanstack/react-table` with shadcn styling
- **Forms:** `@tanstack/react-form` with Zod resolvers
- **Toasts:** `sonner` (shadcn-compatible)
- **Animations:** `tailwindcss-animate` (already part of shadcn); no Framer Motion

---

## Design tokens (Tailwind preset)

## Design tokens (Tailwind preset)

Color, spacing, and typography tokens live in `@mr/tailwind-preset` (`tooling/tailwind/index.css`).
**Authoritative reference:** `docs/15-brand-guidelines.md` (brandbook May 2026).

Light/dark role tokens, semantic `mr-*` colors, and shadcn CSS variables (`--primary`, `--background`, etc.)
are defined there. Do not duplicate hex values in this file.

### Claim outcome colors

Outcome and kind badges use brandbook semantic tokens via `@mr/shared` constants
(`OUTCOME_BADGE_CLASSES`, `KIND_BADGE_CLASSES`) — not Tailwind amber/emerald defaults.

### Badge colors (all badges)

Every badge routes color through brandbook `mr-*` tokens and shares the pill shell
`BADGE_SHELL_CLASSES` from `@mr/ui` (consistent hover/transition). Never hardcode
Tailwind palette colors (`violet-*`, `sky-*`, `amber-*`, …) in a badge.

Admin user/role + status badges map as follows (colors chosen so a role badge and a
status badge in the same table row are always distinct):

| Badge | Value | Token |
|-------|-------|-------|
| role: admin | brand red | `mr-brand` |
| role: operator | info blue | `mr-info` |
| role: viewer | neutral gray | `mr-neutral` |
| role: client | accent teal | `mr-accent` |
| status: pending | warning amber | `mr-warning` |
| status: approved | success green | `mr-success` |
| status: rejected | error red | `mr-error` |

admin (brand red) and rejected (error red) are both red, but an admin user can never
have a rejected status (protected super-admin), so that pair never renders together.

### Typography scale

Use the **`Heading`** component from `@mr/ui` with brandbook levels. Do not use ad-hoc
`text-3xl` / `text-sm font-semibold` for page or section titles.

| Level | Utility / component | Desktop | Mobile | Use |
|-------|---------------------|---------|--------|-----|
| Display | `Heading level="display"` | 64px | 40px | Hero only — one per page |
| H1 | `Heading level="h1"` | 48px | 32px | Page title |
| H2 | `Heading level="h2"` | 36px | 28px | Major section, list titles |
| H3 | `Heading level="h3"` | 28px | 22px | Card sections (claim detail) |
| H4 | `CardTitle` / `Heading level="h4"` | 22px | 18px | Widget / form card title |
| Body | default (`text-base`, 16px on `body`) | 16px | 16px | Primary reading text |
| Body large | `text-body-lg` | 18px | 18px | Lead paragraph |
| Caption | `text-sm` / `text-caption` | 14px | 14px | Labels, table cells, inputs |
| Micro | `text-xs` | 12px | 12px | Badges, fine print (**frozen for badges**) |

**Semantic HTML:** use `as` prop when visual level differs from document outline
(e.g. `<Heading level="h3" as="h2">` for a section under one page H1).

**Uppercase labels/buttons:** `tracking-label` (+0.04em) — Phase 3 buttons.

Monospace: `font-mono text-xs` — IDs, MR numbers, claim numbers.

### Spacing (8px base)

Use Tailwind defaults; prefer `gap-*` over `space-x-*`/`space-y-*` with flex/grid.

### Breakpoints

- `sm`: 640px — not really used; we jump to md
- `md`: 768px — tablets; sidebar collapses to hamburger
- `lg`: 1024px — default working size
- `xl`: 1280px — spacious layouts
- `2xl`: 1536px — extra-wide dashboards

---

## Layout anatomy

### AppShell (internal + admin web)

```
┌─────────────────────────────────────────────────────────────────┐
│  TopBar                                                          │
│  [Logo]    [Breadcrumbs]                      [Lang] [UserMenu]  │
├────────────┬────────────────────────────────────────────────────┤
│            │                                                     │
│  Sidebar   │   PageContent                                       │
│            │                                                     │
│  Nav item  │   <PageHeader />                                    │
│  Nav item  │                                                     │
│  Nav item  │   <PageActions />     (right-aligned)               │
│            │                                                     │
│            │   <MainContent />                                   │
│            │                                                     │
│            │                                                     │
└────────────┴────────────────────────────────────────────────────┘
```

- Sidebar width: `w-60` (240px), collapsible to `w-14` (56px) icon-only
- TopBar height: `h-14` (56px)
- Content max-width: none (tables need full width); page-specific pages can constrain with `max-w-5xl mx-auto`

### Portal layout (simpler)

```
┌─────────────────────────────────────────────────────────────┐
│  [Logo]                            [Lang] [Name] [Logout]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Moje reklamacije                                            │
│  [Aktivne (3)]  [Arhivirane (12)]                           │
│                                                              │
│  <ClaimsList />                                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

No sidebar. Centered, `max-w-5xl`.

---

## Key reusable components (live in `packages/ui/` or `apps/*/components/`)

### `<DataTable />`

TanStack Table wrapper with shadcn styling.

Features:
- Column sorting (click header)
- Server-side pagination
- Server-side filtering
- Column visibility toggle
- Row click navigates to detail page
- Bulk select checkbox column (optional)
- Empty state slot
- Loading skeleton

Usage:
```tsx
<DataTable
  columns={emotiveClaimsColumns}
  queryKey="emotive-claims"
  queryFn={fetchEmotiveClaims}
  filters={<EmotiveClaimFilters />}
  onRowClick={(claim) => navigate(`/emotive-claims/${claim.id}`)}
  emptyState={<NoClaimsYet />}
/>
```

### `<ComboboxAsync />`

Searchable dropdown with inline "+ Add new" option.

Used for: employee picker, customer picker, engine type picker.

Props:
```ts
interface ComboboxAsyncProps<T> {
  value: T | null
  onChange: (value: T) => void
  searchFn: (query: string) => Promise<T[]>
  renderItem: (item: T) => ReactNode
  onCreate?: (query: string) => Promise<T>  // enables "+ Create" option
  placeholder?: string
  disabled?: boolean
}
```

When `onCreate` is provided, an "+ Add {query}" item appears at the bottom
of search results when no exact match is found.

### `<DatePicker />`

shadcn Calendar inside Popover. Always shows in user's locale (Serbian months
for `sr`, English for `en`). Format: `DD.MM.YYYY` display, ISO in value.

### `<FileDropzone />`

Drag-drop area for attachments. Integrated with `react-dropzone`. Shows:
- Drop area with icon + text
- Preview grid of selected files (images: thumbnail; other: icon + filename)
- Per-file: caption input, remove button, visibility toggle
- Upload progress bars
- Error messages per file

### `<Can />`

Permission gate.

```tsx
<Can permission="emotive_claims.delete">
  <DeleteButton claimId={id} />
</Can>

<Can anyOf={['emotive_claims.update', 'emotive_claims.delete']}>
  ...
</Can>
```

### `<ConfirmDialog />`

For destructive actions. Controlled (`open`/`onOpenChange`); the confirm button
shows a spinner while `pending`. Cancel defaults to the shared `action_cancel` label.

```tsx
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Obriši reklamaciju"
  description="Reklamacija će biti prebačena u kantu. Možeš je vratiti kasnije."
  confirmLabel="Obriši"
  variant="destructive"
  pending={isPending}
  onConfirm={() => deleteClaim(id)}
/>
```

### `<StatCard />`

Headline number with optional trend.

```tsx
<StatCard
  label="Ukupno reklamacija 2026"
  value={52}
  trend={{ direction: 'down', percent: 12, label: 'u odnosu na 2025' }}
  icon={ClipboardListIcon}
/>
```

### `<ChartCard />`

Card wrapping a recharts chart with consistent padding, title, legend positioning.

---

## Form conventions

- Forms use `@tanstack/react-form` with Zod schema from `packages/shared`
- Labels always above inputs (not beside)
- Required fields marked with a small red asterisk after the label
- Validation errors appear below the input in red, with an icon
- "Sačuvaj" (Save) button is always primary, right-aligned, last in the form
- "Otkaži" (Cancel) button is secondary, left of Save
- Complex forms use `<FormSection />` with title dividers
- Form state persists in localStorage under `draft:<form-key>`; cleared on successful save or explicit cancel

### Form autosave

For long forms (claim create), every 5 seconds while dirty:
```ts
useFormAutosave({
  key: `draft:emotive-claim:new`,
  values: form.state.values,
  enabled: form.state.isDirty && !form.state.isSubmitting,
})
```

On navigation away with unsaved changes, show `<UnsavedChangesDialog />`.

---

## Table/list page conventions

Every list page has this structure:

```
┌────────────────────────────────────────────────────┐
│  Page Title                                        │
│  Descriptive subtitle (optional)                   │
│                                                    │
│  [+ New claim]                     [Export Excel]  │
├────────────────────────────────────────────────────┤
│  Filters row:                                      │
│  [Year ▼] [Outcome ▼] [Employee ▼] [🔍 Search]   │
├────────────────────────────────────────────────────┤
│                                                    │
│  <DataTable />                                     │
│                                                    │
├────────────────────────────────────────────────────┤
│  Showing 1–20 of 521   [‹] 1 2 3 ... 27 [›]        │
└────────────────────────────────────────────────────┘
```

---

## Detail page conventions

Claim detail page has three tabs:

```
Reklamacija #512 — BMW N47D20        [Edit] [Delete] [⋮]

[Podaci] [Zapažanja (3)] [Fajlovi (12)]
─────────────────────────────────────────────
  (tab content)
```

Above the tabs: breadcrumb + quick action bar.

### Observations tab

Thread-like layout, newest at top:

```
┌────────────────────────────────────────────────┐
│  [+ Add observation]                           │
├────────────────────────────────────────────────┤
│  Ivica Stanisavljević • 14 April 2026, 11:32  │
│  Internal                                      │
│  ─────────────────                             │
│  Motor je u potpunosti rasklopljen, slike su   │
│  priložene. Čeka se odluka proizvođača.        │
│  [Edit] [Delete]                               │
├────────────────────────────────────────────────┤
│  Nikola M. • 13 April 2026, 09:15             │
│  Client visible                                │
│  ─────────────────                             │
│  Reklamacija primljena. Analiza u toku.        │
│  🌐 Translate                                  │
└────────────────────────────────────────────────┘
```

### Files tab

Grid of thumbnails (images/videos) + list of documents. Click to open lightbox
(for images/videos) or download (for documents).

---

## Statistics page conventions

- Top row: 4 `<StatCard />` with key numbers
- Second row: 2 `<ChartCard />` side-by-side on desktop, stacked on mobile
- Third row: smaller charts or tables
- Filter bar at top (year, date range, etc.) — changes propagate via TanStack Query

Never put 6+ charts on one screen — it becomes unreadable.

---

## Admin-specific UI

### Role editor

```
┌── Uređivanje role: Senior Operator ──────────────────┐
│  Ime: [Senior Operator          ]                    │
│  Opis: [Iskusniji operator sa pravom brisanja]       │
│                                                      │
│  Permisije: (klikni kategoriju da razviješ)          │
│                                                      │
│  ┌── ▼ Inostrane reklamacije ────────────────────┐  │
│  │  ☑ Pregled                                     │  │
│  │  ☑ Kreiranje                                   │  │
│  │  ☑ Izmena                                      │  │
│  │  ☑ Brisanje                                    │  │
│  └────────────────────────────────────────────────┘  │
│  ┌── ▶ Domaće reklamacije (4 selected) ──────────┐  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  [Kopiraj iz role...▼]  [Otkaži]  [Sačuvaj]         │
└──────────────────────────────────────────────────────┘
```

Permission groups collapsed by default; click to expand. Summary shows count in header.

### User editor

```
┌── Uređivanje korisnika: Petar Zorić ─────────────────┐
│                                                      │
│  Email: petar.zoric@mrengines.rs                     │
│  Ime: Petar Zorić                                    │
│  Jezik: [Srpski ▼]                                   │
│  Status: ☑ Aktivan    ☑ 2FA aktiviran               │
│                                                      │
│  Role:                                               │
│    ☑ Operator                                        │
│    ☐ Viewer                                          │
│    ☐ Admin                                           │
│    ☐ Senior Operator   (custom)                      │
│                                                      │
│  Efektivne permisije:                                │
│    Inostrane reklamacije (5)   [prikaži]             │
│    Domaće reklamacije (5)      [prikaži]             │
│    ...                                               │
│                                                      │
│  [Resetuj lozinku]  [Deaktiviraj]  [Otkaži] [Sačuvaj]│
└──────────────────────────────────────────────────────┘
```

---

## Internationalization (i18n)

Powered by **Paraglide**.

- Every user-visible string goes through Paraglide: `m.login_submit()`, `m.claim_created_success()`
- Strings keyed in English (`login_submit`, `claim_created_success`), with both `en` and `sr` values
- ICU message format supported for pluralization, gender, etc.
- Language switcher in TopBar / portal header:
  - Admin/internal: user preference stored in `users.preferred_language`
  - Portal: same preference, displayed prominently
- Date and number formatting uses `Intl.DateTimeFormat` / `Intl.NumberFormat` with user locale

### Translation key namespacing

- `nav.*` — sidebar, navigation labels
- `action.*` — button verbs (save, cancel, delete)
- `field.*` — form field labels
- `validation.*` — form error messages
- `success.*` — success toast messages
- `error.*` — error toast messages
- `claim.*` — claim-related labels
- `stats.*` — statistics page labels
- `admin.*` — admin-only labels

---

## Accessibility

- All interactive elements keyboard-reachable
- Focus ring always visible (Tailwind's `focus-visible:ring-2 focus-visible:ring-ring`)
- Form labels properly associated via `htmlFor`
- Color never the only signal (outcome badge has text + color)
- ARIA labels on icon-only buttons
- Table sort direction announced via aria-sort
- Error messages associated with input via `aria-describedby`
- Images in claims have alt text from caption (or filename fallback)
- Skip-link at top of page for screen readers: "Skip to main content"
- Respect `prefers-reduced-motion` — disable transitions for users who set it

Lighthouse accessibility score target: **95+** on all public pages.

---

## Responsive behavior

| Viewport | Shell behavior |
|---|---|
| < 768px | Sidebar becomes drawer (hamburger in top bar); tables become stacked cards |
| 768–1024px | Sidebar collapsed to icons (w-14); tables scroll horizontally |
| > 1024px | Full sidebar (w-60); full tables; default layout |

Portal is always simple enough to work on any viewport.

Print styles: claim detail prints cleanly (hide sidebar/top bar; expand tabs to sections).

---

## Performance targets

- First contentful paint: < 1 s on cable connection
- Time to interactive: < 2 s
- Claim list render time: < 300 ms for 100 rows
- Form submit round trip: < 500 ms
- Bundle size per app: < 300 KB gzipped (initial); lazy-load heavy features

## Dark mode

Supported across all three apps. Toggle in user menu. Preference stored in
`localStorage.theme = 'light' | 'dark' | 'system'` plus reflected in
`<html data-theme="">` for server-rendered consistency.

---

## Empty states, loading states, error states

### Empty state

When a list has zero items:
- Icon
- Headline: "Još nema reklamacija"
- Body: "Kada kreiraš prvu reklamaciju, pojaviće se ovde."
- Primary action: "+ Nova reklamacija" (if user has permission)

### Loading state

- Tables: skeleton rows (shadcn's `<Skeleton />`)
- Detail pages: skeleton header + skeleton tabs content
- Buttons during mutation: `<Button loading={isPending}>` — spinner inline, label unchanged (no “Saving…” text swap); `aria-busy` set automatically

### Error state

- Toast for transient errors (with retry action if applicable)
- Full-page error boundary for unrecoverable errors: "Nešto je pošlo po zlu. Osveži stranicu. Ako se ponovi, kontaktiraj administratora."
- Never show raw error messages or stack traces to end users in production

---

## Component naming

- **PascalCase** for components: `EmotiveClaimForm`
- **camelCase** for hooks: `useEmotiveClaims`
- **kebab-case** for file names: `emotive-claim-form.tsx`
- Components and hooks match their file name 1:1

## Page title and meta

Every page sets document title via TanStack Router's `head` property:

```ts
export const Route = createFileRoute('/emotive-claims/$claimId')({
  head: ({ params }) => ({
    meta: [{ title: `Reklamacija #${params.claimId.slice(0, 8)} — MR Reklamacije` }],
  }),
  component: ClaimDetailPage,
})
```
