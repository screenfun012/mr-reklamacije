# 21 — In-app notifications (bell, panel, popups)

**Status:** implemented 2026-07-22. Design approved by Nikola in conversation; the UI
follows `docs/design-handoffs/2026-07-21-notification-center-ui.md` and the glass
recipe in `2026-07-21-glass-final-handoff.md`. A later popup handoff
(`2026-07-22-popup-notifikacija-handoff.md`) is a **visual orientation only** — where it
disagreed with the agreed behaviour, the agreed behaviour won (see "Settled decisions").

## Why

Workers were texting to ask whether something had been done yet — "did you add that
engine type?", "did anyone take the new submission?". Notifications answer those in
the app instead of on the phone.

## Data model

One table, `notifications` (migration `0032_motionless_solo`). **One row per recipient
per event** — the fan-out happens on write, so read state is naturally per person and
the inbox is a single indexed read. The team is small; a handful of rows per event costs
nothing.

| column | meaning |
| --- | --- |
| `user_id` | the recipient (FK → users, cascade) |
| `type` | `new_submission \| outcome_changed \| claim_created \| assigned_to_me \| catalog_added` |
| `entity_type` / `entity_id` | what it points at; `catalog` has no screen to open |
| `data` (jsonb) | only what the title needs: `mrNumber`, `customerName`, `outcome`, `catalog`, `itemName` |
| `is_read` / `read_at` | per-recipient read state |
| `snoozed_until` | popup postponed until this moment; the row stays **unread** |

Indexes: `(user_id, created_at DESC)` for the list, and a partial index on unread rows
so the badge count never scans read history.

Rows are permanent — a notification is a log entry. Dismissing a popup deliberately does
**not** delete it.

## Events and recipients

The acting user is never notified of their own action.

| type | fired at | recipients |
| --- | --- | --- |
| `new_submission` | client-submission create | holders of `client_submissions.manage` |
| `claim_created` | EMOTIVE/DOMACE claim create | holders of the matching `*_claims.view` |
| `outcome_changed` | change-outcome | holders of the matching `*_claims.view` |
| `assigned_to_me` | claim create/update when the assigned worker changes | only the user linked to that employee (`employees.user_id`); silently skipped when unlinked |
| `catalog_added` | **create only** in engine types, engine manufacturers, customers | holders of `emotive_claims.view` |

`catalog_added` covers exactly the three catalogs that block claim entry — the dropdowns
a worker cannot finish a claim without. The other four catalogs stay silent on purpose.
Its title is neutral ("Sistem: dodat tip motora — …"); it never names who added the entry.

If a user would receive both `claim_created` and `assigned_to_me` for the same claim they
get only `assigned_to_me` — the more specific one.

⚠️ Recipient resolution must include admins explicitly: the `admin` role gets
`ALL_PERMISSIONS` from the resolver and is **not** guaranteed to have `role_permissions`
rows, so a naive permission join silently skips them.

Viewers hold no `notifications.view_own` permission — no bell, no rows.

## API

All routes require `notifications.view_own` and are scoped to the calling user; another
user's row 404s (never 403 — don't leak existence).

```
GET  /api/notifications?page&pageSize → { items, total, page, pageSize, unreadCount }
POST /api/notifications/:id/read      → 204 (idempotent)
POST /api/notifications/mark-all-read → 204
POST /api/notifications/:id/snooze    → 204   body { until: ISO }
```

Read and snooze write no audit entries — they are personal view state, not business
state (same reasoning as the claims `mark-seen` endpoint).

## Realtime

New SSE event `notification_created`, **signal only**: the payload carries the id and
nothing else; the text never travels over the wire. Routed to the recipient's user
channel, so a notification reaches exactly one person. The client invalidates its inbox
query — it never writes the SSE payload into cache.

## UI

- **Bell** in the topbar with an unread badge (capped `9+`), opening a glass panel with
  the list, per-row read state, "Sve pročitano", and skeleton/empty/error states.
- **Popups** stack in the top-right corner, at most three, newest on top:
  - they appear **only for notifications that arrive while the app is open** — never the
    backlog on load, which would greet a user with a wall of cards every morning;
  - auto-dismiss after 8s with a progress bar; hovering or opening the snooze menu pauses it;
  - **✕ / Odbaci** only hides the popup — the row stays unread in the bell;
  - **Otvori** marks it read and navigates (a `catalog_added` popup only marks read — it
    has nowhere to go);
  - **Odloži** offers 15 min / 1 h / 3 h / tomorrow 08:00. The chosen moment is stored
    **server-side** (`snoozed_until`), so a snooze holds across reloads and devices. The
    client resolves the preset because "tomorrow morning" means the worker's local
    morning, which the server cannot guess.
  - popups stay silent while the panel is open.

The panel and popups share one presentation module (icon, title, eyebrow, target) so the
two can never drift apart.

## Settled decisions (where the popup handoff was overridden)

| topic | handoff draft | agreed and built |
| --- | --- | --- |
| auto-dismiss | ~6 s | **8 s** |
| "tomorrow morning" | 09:00 | **08:00** |
| snooze persistence | client or server | **server** (`snoozed_until`) |

## Consequences

- The pending-count badge next to "Pristiglo" in the sidebar was **removed** —
  notifications are the single place now. Its client query factory went with it. The
  `GET /api/client-submissions/pending-count` endpoint is left in place but currently has
  no consumer; remove it deliberately if nothing adopts it.
- New permission `notifications.view_own` → **after deploying, run
  `pnpm --filter @mr/db run db:seed` once** so it exists in production and is granted to
  `operator` (admin gets it through the `ALL_PERMISSIONS` bypass).

## Deliberately not built

Per-user "which events do I want" settings, email delivery, deleting notifications, and
automatic pruning of old rows. Each is its own task if it is ever wanted.
