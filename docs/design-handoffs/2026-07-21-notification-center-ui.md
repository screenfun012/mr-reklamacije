# Notification Center — UI — Design Handoff

**For:** Claude Design · **App:** `internal-web` (operators, dark-default) · **Type:** new UI. Backend (table / API / SSE / fan-out) is built separately by me — **build the frontend against the data contract below.**

## Goal

A notification **inbox**: a bell in the topbar with an unread-count badge, and a
panel that lists notifications (per-item read/unread + history). Click a
notification → mark it read + jump to the claim/submission.

## Placement — the bell

- A `Bell` (lucide) icon button in `apps/internal-web/src/components/layout/internal-topbar.tsx`, in the **right cluster** next to `<LocaleThemeControls />`.
- Match the existing topbar icon-button style exactly:
  `grid size-9 flex-none place-items-center rounded-[9px] text-mri-text2 transition-colors hover:bg-mri-rowhv hover:text-mri-text`, icon `size-5`.
- **Unread badge:** a small count bubble at the bell's top-right — `--mri-red` background, white text, `font-mono`, capped `9+`. Hidden when `unreadCount === 0`.

## The panel

- Opens on bell click, anchored under the bell, right-aligned. Use the `@mr/ui`
  `popover`/`dropdown-menu` primitive **or** a custom panel — whichever matches best.
- Surface: `--mri-raised`, `border border-mri-border`, `shadow-[var(--mri-shadow)]`, radius ~12–14px, width ~380px, `max-h-[70vh]` with internal scroll.
- **Header row:** title "Obaveštenja" (i18n) on the left; a "Sve pročitano" text action on the right (in `--mri-text2`, hover `--mri-text`), **disabled when `unreadCount === 0`**.
- **List** (newest first), one row per notification:
  - **Unread:** a small `--mri-red` dot at the left + primary text `text-mri-text`. **Read:** no dot, muted `text-mri-text2`.
  - A per-type icon (lucide), the title, and a relative timestamp (`text-mri-text2`, e.g. "pre 2 min" — use `Intl`/existing helper).
  - Whole row clickable, hover `bg-mri-rowhv`.
- **States (all required):** loading = **skeleton rows** (not a spinner); empty = "Nema obaveštenja"; error state. Follow the app's existing list conventions.

## Interactions

- Click a row → `POST /api/notifications/:id/read` (optimistic mark-read is fine, with rollback) **then navigate** to the target (below).
- "Sve pročitano" → `POST /api/notifications/mark-all-read`, clears badge.
- Realtime: an SSE signal tells the client to refetch — use the app's existing query-invalidation pattern (do **not** write SSE payloads into cache). The bell badge reads `unreadCount` from the list query.

## Data contract (I implement the API to match this exactly)

```
GET /api/notifications?page=1&pageSize=20
  → { items: NotificationItem[], total: number, page: number, pageSize: number, unreadCount: number }

NotificationItem = {
  id: string
  type: 'new_submission' | 'outcome_changed' | 'claim_created' | 'assigned_to_me'
  entityType: 'client_submission' | 'emotive_claim' | 'domace_claim'
  entityId: string
  isRead: boolean
  createdAt: string   // ISO
  data: {             // fields needed to render the localized title
    mrNumber?: string
    customerName?: string
    outcome?: 'pending' | 'accepted' | 'rejected' | 'archived'
  }
}

POST /api/notifications/:id/read        → 204 (idempotent)
POST /api/notifications/mark-all-read   → 204
```

Data access: a `queryOptions` factory (I'll add it to `@mr/shared/src/queries`) + `useQuery`; `unreadCount` drives the badge.

## Title composition (frontend, via Paraglide `m.*`, sr + en)

The frontend renders the localized title from `type` + `data` (I'll provide the fields; add the i18n keys):

| type | template (sr) | needs |
| --- | --- | --- |
| `new_submission` | "Nova prijava — {customerName}" | `customerName` |
| `outcome_changed` | "Ishod: {mrNumber} → {outcomeLabel}" | `mrNumber`, `outcome` |
| `claim_created` | "Nova reklamacija — {mrNumber}" | `mrNumber` |
| `assigned_to_me` | "Dodeljena ti: {mrNumber}" | `mrNumber` |

(`outcomeLabel` reuses existing outcome i18n.)

## Navigation targets (by entityType — same as `claims-table.tsx`)

- `client_submission` → `/pristiglo/$id` (params `{ id: entityId }`)
- `emotive_claim` → `/reklamacije/emotive/$id` (params `{ id }`, search `{ tab: 'pregled' }` via `CLAIM_DETAIL_DEFAULT_SEARCH`)
- `domace_claim` → `/reklamacije/domace/$id` (same search)

## Design system

Same `--mri-` tokens as the palette-restyle handoff (see `apps/internal-web/src/styles/globals.css` + `internal-topbar.tsx`). Dark default + `.light`. Accessible: `aria-label` on the bell, focus management, esc/click-outside to close, badge announced.

## Files

- `apps/internal-web/src/components/layout/internal-topbar.tsx` — mount the bell (import a new `NotificationBell`).
- New `apps/internal-web/src/features/notifications/` — `notification-bell.tsx`, the panel, row component, and (frontend) title/timestamp helpers. I'll add the `@mr/shared` query factory + wire the API/SSE.

## Handback

Return the components built against the contract; I wire the API + SSE + i18n keys + integrate + run the gate. Screenshots (dark + light, with unread + empty states) appreciated.
