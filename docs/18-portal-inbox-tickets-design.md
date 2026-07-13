# docs/18 — Client Portal Submissions → Internal Inbox → Claim (ticket system)

> **Status: PREDLOG (proposed).** Brainstormed and agreed with Nikola on 2026-07-13.
> Implementation NOT started. This is the approved design direction; the implementation
> plan follows separately. Domain terms kept verbatim (EMOTIVE, DOMACE, MR NUMBER).

---

## 1. Goal

Let a **logged-in portal client** send a lightweight request ("something is wrong with my
engine") through the portal. The request lands in the internal **Inbox** ("Pristiglo"), where an
employee either **turns it into a claim** (reklamacija) or **dismisses** it. A helpdesk/ticket
flow — the exact intent the `/pristiglo` placeholder already promises ("client requests submitted
through the client portal will appear here — ready for one-click claim creation").

The internal Inbox (`/pristiglo`, `apps/internal-web/src/routes/_shell/pristiglo.tsx`) is today a
static Phase-2 placeholder with **no backing table or API** — this feature is greenfield but the
rails exist (client accounts via `customer_users`, attachments, SSE, audit, Resend email).

## 2. Confirmed decisions (from brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Who submits | **Only logged-in portal clients** (linked to a customer via `customer_users`). |
| 2 | Form content | **The claim reason (razlog / GREŠKA) + attachments** (photos/documents). The client owns the complaint *reason*; the employee owns the internal *findings*. No other structured fields. |
| 3 | Flow | **One-way** — no back-and-forth conversation. |
| 4 | Client visibility after sending | **Minimal** — "received" confirmation; the resulting claim later appears in their existing claims list. No separate request-tracker, rejections not shown. |
| 5 | Conversion target | **EMOTIVE claim**, but the conversion is **kind-aware**: it reads the linked customer's `kind`. Today every portal client is `emotive_partner` → EMOTIVE. Forward-compatible for domestic later (see §12). |
| 6 | Employee notification | **Email** to a configurable recipient (default `claims@mrgroup.rs`) via the existing Resend integration, plus a live badge count in the Inbox. |

## 3. Scope

**In (v1):** portal submission form; `client_submissions` table + API module; internal Inbox list
+ badge + detail; "Open claim" (convert) and "Reject" actions; attachment carry-over; email
notification; RBAC; audit; SSE.

**Out (v1) — deliberately deferred, all easy to add later:**
- Two-way conversation / replies.
- Client-facing request status tracker on the portal.
- Email/notification **to the client**.
- DOMACE submissions — blocked on the "domestic customers as first-class entities" project (§12).
- Public/anonymous intake (non-logged-in submitters).

## 4. Data model — new table `client_submissions`

A new lightweight entity; does **not** touch the claims tables until an employee converts.

| column | type | notes |
|--------|------|-------|
| `id` | uuid PK | |
| `customer_id` | uuid FK → customers | the client's firm (from `customer_users`); scopes row-level access |
| `submitted_by_user_id` | uuid FK → users | the client user who sent it |
| `message` | text | the client's **reason for the claim** (razlog / GREŠKA); maps to the claim's `warrantyReport` on conversion |
| `status` | text + CHECK | `pending` \| `converted` \| `rejected` (enum-like text, extensible) |
| `linked_emotive_claim_id` | uuid FK, nullable | set on conversion (kind-aware: a `linked_domace_claim_id` slot may be added when domestic is enabled) |
| `rejected_reason` | text, nullable | internal, not shown to the client |
| `handled_by_user_id` | uuid FK, nullable | employee who converted/rejected |
| `handled_at` | timestamptz, nullable | |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | soft-delete like all business data |

- Index `customer_id`, `status`, `created_at` (Inbox lists pending by recency; per-customer scope).
- Attachments reuse the **existing attachment system** (see §8) — initially attached to the
  submission, re-associated to the claim on conversion.

## 5. Portal — submission flow

- New **"Prijavi problem"** button/entry on the portal (dashboard/nav).
- Form: **reason (razlog reklamacije)** + file upload (attachments) — reuse the portal's existing upload UX. No separate subject; the reason text is the content (the Inbox shows a reason excerpt).
- Submit → `POST /api/client-submissions` → confirmation toast "Zahtev primljen".
- **New client write permission** `client_submissions.create` (added to `CLIENT_PERMISSIONS` —
  the client role currently has **no** write permission at all). Row scope: a client may only
  create submissions for the customer(s) they are linked to.
- **Rate limit** per user (defense-in-depth; low risk since logged-in only).

## 6. Internal — Inbox ("Pristiglo")

- Wire `/pristiglo` to a real list of **pending** submissions (card/row: firm · subject · message
  excerpt · time · attachment count). Empty/loading/error states.
- **Badge count** on the Inbox nav tab (number of pending), updated live via SSE.
- Detail view: full message + attachment previews/downloads + the two actions.
- Gated by new operator/admin permissions `client_submissions.view` / `.convert` / `.reject`.

## 7. Conversion — "Open claim"

- Opens the **EMOTIVE create form pre-filled**: customer = the submission's firm; the client's
  reason → the claim's **reason / razlog (`warrantyReport` / GREŠKA)**; **attachments transferred**.
  The employee completes the required internal fields (engine type, MR number, date) and the
  **internal findings** (`inspectionReport` / `internalNotes`), then saves.
- **Field ownership:** the client owns the *reason* (what is wrong); the employee owns the *internal
  findings*. This "rotates" the current convention (today the employee types the reason). For claims
  an employee creates directly (not from a submission) nothing changes — they still fill the reason.
- Uses the **existing** `POST /api/emotive-claims` create flow (one endpoint, one transaction —
  respects the locked claims rule in `docs/04`). **No optimistic update** for claim create.
- On success: submission `status = converted`, `linked_emotive_claim_id` = the new claim; it leaves
  the active Inbox.
- **Kind-aware:** the service reads the linked customer's `kind`. Today `emotive_partner` → EMOTIVE.
  When domestic customers become first-class (§12), the same path produces a DOMACE claim with no
  rework.

## 8. Attachments

Reuse the existing attachment/storage infrastructure (MinIO/S3, magic-byte MIME check, size limits,
signed URLs). Files are uploaded against the submission; on conversion they are re-associated to the
created claim. **Exact linking mechanism (polymorphic parent vs. move-on-convert) to be confirmed
against the attachments module during planning.**

## 9. Rejection

- "Reject" → `status = rejected` + optional internal `rejected_reason`; leaves the active Inbox.
- Client does **not** see rejections (per decision #4).

## 10. Email notification

- On new submission → best-effort email via the **existing Resend `emailPort`** (already configured
  and working in prod; FROM is the configured sender, currently `auth.info@mrengines.global`).
- **Recipient is configurable** (admin setting, default `claims@mrgroup.rs`) so it points at a
  mailbox that is actually monitored. The recipient needs **no** Resend setup — it just receives.
- Content: firm + subject + message excerpt + a link to `/pristiglo`.
- **Best-effort:** a failed send never fails the submission (it is already in the Inbox).
- Config-gated by the existing pattern: if Resend is unset the port is a silent no-op.
- Note: `RESEND_FROM_EMAIL` docs elsewhere say `mrengines.rs` — that is stale; reality is
  `mrengines.global` on a colleague's Resend account. Fix the doc drift when convenient.

## 11. RBAC, SSE, audit (admin-control-plane, docs/13)

- **Permissions (server is the judge, every route `requirePermission`):**
  - `client_submissions.create` → CLIENT_PERMISSIONS (row-scoped to own customer).
  - `client_submissions.view` / `.convert` / `.reject` → operator + admin.
- **SSE:** new event type (e.g. `client_submission`), signal-only (`type + id`, no payload); the
  internal client invalidates the Inbox list query + badge. Server stays the single source of truth.
- **Audit** every state change (create, convert, reject) with actor + IP + UA + diff.
- **Admin hooks:** state changes write audit; the notification recipient is a catalog/setting, not
  hardcoded; gated actions map to named permissions.

## 12. Out of scope — the domestic-customer gap (separate future project)

This feature surfaced a real structural gap. The `customers` table and `CustomerKind` enum already
support `emotive_partner` / `domestic_company` / `domestic_individual`, and portal clients are
"typed" simply by the `kind` of the customer they link to — **the mechanism already exists.** But
**domestic customers are not first-class in practice**: DOMACE claims store a free-text
`customer_name` and never link a `customers` record, so no domestic customer records exist and no
domestic client can have a portal account today. Every portal client is therefore an emotive partner.

Enabling **domestic** portal clients (whose submissions become DOMACE claims) requires a separate,
deliberate project: make domestic customers first-class records and decide how DOMACE claims relate
to them (currently free-text — a "locked" area per `docs/04`). This ticket feature is built
kind-aware so it will work unchanged once that project lands. **Spec that separately; do not start it
casually.**

## 13. Open questions for the planning stage

- Attachment linking mechanism (polymorphic parent vs. transfer on convert).
- Rate-limit thresholds.
- Should `.view/.convert/.reject` be three permissions or one `.manage`?

## 14. Testing

- Integration (real Postgres): create submission (row-scoped), list pending, convert → EMOTIVE claim
  created + submission linked/converted + attachments carried, reject → rejected, permission denials
  (404 for cross-customer per `docs/05`), audit rows written, email port invoked (recording port).
- Web components: portal form validation/submit; Inbox list states + badge; convert opens pre-filled
  create form.
- Every state change ships a regression test.
