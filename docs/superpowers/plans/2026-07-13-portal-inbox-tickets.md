# Portal → Inbox → Claim (ticket system) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use `- [ ]` for tracking. **Ponytail is in force:** reuse existing modules/patterns, smallest working diff, no unrequested abstractions. **Every task is test-first (TDD) with real Postgres** (never mock DB/services), and every phase ends green on the full gate before moving on.

**Goal:** Let a logged-in portal client submit a reason + attachments; it lands in the internal Inbox ("Pristiglo"); an employee converts it into an EMOTIVE claim (kind-aware) or rejects it, with an email notice to a configurable address.

**Architecture:** One new table `client_submissions` + a new API module mirroring the existing catalog modules (repo/service/controller/routes/validators). Attachments reuse the existing polymorphic table (new `client_submission_id`, re-pointed to the claim on convert). Portal gets one write path (mirrors `registration`); the internal `/pristiglo` route is wired to a real list + badge. Email via the existing `emailPort` (Resend). SSE + audit follow existing conventions.

**Tech stack:** Hono · Drizzle/Postgres · TanStack Start/Query · Better-Auth RBAC · Zod · Resend · Vitest/Playwright. Design spec: `docs/18-portal-inbox-tickets-design.md`.

**Reference modules to mirror (read these first, copy the shape):**
- API module pattern: `apps/api/src/modules/external-parties/*` (simplest full CRUD module).
- Attachments (upload/serve/storage): `apps/api/src/modules/attachments/*`, schema `packages/db/src/schema/attachments.ts`.
- Claim create (conversion target): `apps/api/src/modules/emotive-claims/*` + `packages/shared/src/schemas/emotive-claim.schema.ts`.
- Permissions + seed: `packages/shared/src/permissions.ts`, `packages/db/src/seed/{permissions,roles}.ts`.
- SSE: `apps/api/src/modules/events/*` (emit) + `apps/internal-web/src/lib/handle-app-event.ts` (invalidate).
- Portal write + form: `apps/portal-web/src/routes/register.tsx` + `packages/shared/src/queries/registration.ts`.
- Inbox placeholder to replace: `apps/internal-web/src/routes/_shell/pristiglo.tsx` + `apps/internal-web/src/config/navigation.ts`.
- Email: `apps/api/src/core/ports/email-port.ts` + `apps/api/src/modules/activation/activation.service.ts` (how it calls `emailPort`).

**Resolved decisions (were open in spec §13):**
- Attachments: extend the existing `attachments` one-of with `client_submission_id`; on convert `UPDATE` rows to the new emotive claim (no file copy). Serve-auth extended so a submission owner can view its own files.
- Rate-limit: reuse the existing rate-limit middleware, **20/hour/user** on the create route.
- Permissions: **two** — `client_submissions.create` (CLIENT) and `client_submissions.manage` (OPERATOR + ADMIN, covers view/convert/reject).
- Notification recipient: constant default `claims@mrgroup.rs` (already in `SUPPORT_EMAIL_BY_KIND`), overridable via an `app_settings` key read at send time. **Admin UI to edit it is deferred** (YAGNI) — env/DB value is enough for v1.
- Client submission message maps to the claim's `warrantyReport` (Razlog) on convert; employee fills findings (spec §7).

---

## ⚠️ Approval gates (per CLAUDE.md — do NOT proceed past these without Nikola's explicit OK)

- **Phase 0 touches a migration AND auth/permissions.** Before applying: verify the journal, generate via `drizzle-kit` (never hand-write SQL), prove clean migrate-from-zero on an empty DB, confirm the DDL is only the intended change. Get Nikola's go before generating/applying.
- Nikola pushes; the full gate must be green before every commit.

---

## File structure

**Create:**
- `packages/db/src/schema/client-submissions.ts` — the table + relations.
- `packages/db/migrations/00NN_*.sql` — generated (client_submissions + attachments.client_submission_id + CHECK update).
- `packages/shared/src/schemas/client-submission.schema.ts` — Zod (create/list/reject inputs, list item, detail).
- `packages/shared/src/queries/client-submissions.ts` — queryOptions + mutation factories.
- `apps/api/src/modules/client-submissions/{validators,repository,service,controller,routes,index}.ts` + `__tests__/`.
- `apps/portal-web/src/routes/_authed/prijava.tsx` (or the portal's authed layout) — submission form.
- `apps/internal-web/src/features/inbox/*` — inbox list + detail + convert/reject UI.

**Modify:**
- `packages/db/src/schema/attachments.ts` — add `clientSubmissionId`, relax the one-of CHECK to 3-way.
- `packages/shared/src/permissions.ts` — add the two permissions; add `create` to `CLIENT_PERMISSIONS`, `manage` to `OPERATOR_PERMISSIONS`.
- `apps/api/src/core/container.ts` — wire the new module (constructor DI).
- `apps/api/src/app.ts` — register routes.
- `apps/api/src/modules/attachments/{service,routes}.ts` — accept a `clientSubmissionId` target; serve-auth allows submission owner.
- `apps/api/src/modules/events/*` — add a `client_submission` event type.
- `apps/internal-web/src/lib/handle-app-event.ts` — invalidate inbox list + badge on that event.
- `apps/internal-web/src/routes/_shell/pristiglo.tsx` — replace placeholder with the real inbox.
- `apps/internal-web/src/config/navigation.ts` — badge count on the Inbox item.
- `apps/api/src/modules/emotive-claims/*` — reuse as-is for convert (no change expected; confirm the create input accepts a pre-filled `warrantyReport` + optional `customerId`).

---

## Phase 0 — DB + permissions (⚠️ migration + auth gate)

### Task 0.1 — `client_submissions` schema + attachments extension
**Files:** create `packages/db/src/schema/client-submissions.ts`; modify `packages/db/src/schema/attachments.ts`, `packages/db/src/schema/index.ts`.
- [ ] Define `client_submissions`: `id` uuid PK, `customerId` uuid FK→customers (restrict), `submittedByUserId` uuid FK→users (restrict), `message` text notNull, `status` text notNull + CHECK `IN ('pending','converted','rejected')` default `'pending'`, `linkedEmotiveClaimId` uuid FK→emotiveClaims nullable, `rejectedReason` text nullable, `handledByUserId` uuid FK→users nullable, `handledAt` timestamptz nullable, `createdAt/updatedAt/deletedAt`. Indexes: `customerId`, `status`, `createdAt`.
- [ ] In `attachments.ts`: add `clientSubmissionId: uuid('client_submission_id')` + FK; change the one-of CHECK to "exactly one of {emotiveClaimId, domaceClaimId, clientSubmissionId}"; add a partial index on `clientSubmissionId`.
- [ ] Export from schema `index.ts`.
- [ ] **Test (integration):** a test that inserts a submission + an attachment pointing at it (asserts the 3-way CHECK accepts submission-only and still rejects two-set). Run against `mr_reklamacije_test`.
- [ ] **⚠️ STOP for Nikola:** generate the migration (`pnpm --filter @mr/db run db:generate`), show the DDL, prove migrate-from-zero, then apply. Commit.

### Task 0.2 — permissions
**Files:** modify `packages/shared/src/permissions.ts`.
- [ ] Add `client_submissions.create` and `client_submissions.manage` to the `PERMISSIONS` list (follow the existing resource.action shape).
- [ ] Add `create` to `CLIENT_PERMISSIONS`, `manage` to `OPERATOR_PERMISSIONS` (ADMIN gets all automatically).
- [ ] **Test:** unit assert both are in `PERMISSIONS`, `create ∈ CLIENT_PERMISSIONS`, `manage ∈ OPERATOR_PERMISSIONS`. Integration: `runSystemSeeds` then assert the client/operator roles have the new junctions (idempotent).
- [ ] Commit.

---

## Phase 1 — API module `client-submissions`

### Task 1.1 — Zod validators + shared schemas
**Files:** create `packages/shared/src/schemas/client-submission.schema.ts`; `apps/api/src/modules/client-submissions/validators.ts` (re-export/compose).
- [ ] `ClientSubmissionCreateInputSchema` = `{ message: z.string().trim().min(1).max(5000) }` (attachments handled via the attachments upload endpoint, keyed to the returned submission id). `ClientSubmissionRejectInputSchema` = `{ reason: z.string().trim().max(2000).optional() }`. List-item + detail schemas (firm name, message, status, counts, timestamps). `z.infer` types exported.
- [ ] **Test:** schema unit tests (min/max, trims, rejects empty message).
- [ ] Commit.

### Task 1.2 — repository (DB only)
**Files:** create `apps/api/src/modules/client-submissions/repository.ts`. Mirror `external-parties.repository.ts`.
- [ ] Methods: `create({customerId, submittedByUserId, message})`; `listPending({page,pageSize})` (JOIN customers for firm name, attachment count, `deleted_at IS NULL`, order by created_at desc); `findById(id)` (with firm + attachments); `markConverted(id, claimId, userId)`; `markRejected(id, reason, userId)`; `listForCustomer(customerId)` (row-scope helper). Explicit return types.
- [ ] **Test (integration):** create → listPending shows it → markConverted moves it out of pending; real Postgres, seed permissions before roles.
- [ ] Commit.

### Task 1.3 — service (business logic + email + SSE + audit)
**Files:** create `apps/api/src/modules/client-submissions/service.ts`. Inject repo, emotive-claims service (for convert), attachments repo (for re-point), emailPort, event bus, audit, config.
- [ ] `create(actor, input)`: resolve the actor's `customerId` via `customer_users` (reject if none → ForbiddenError); insert; **audit**; emit `client_submission` SSE event; best-effort `emailPort.send({to: recipient, subject, body})` wrapped so failure never throws. Return the new id (so the client can upload attachments to it).
- [ ] `convert(actor, id, claimInput)`: load submission (404 if missing/handled); **kind-aware** — read `customers.kind`; today `emotive_partner` → call the existing emotive create with `{...claimInput, customerId: submission.customerId, warrantyReport: claimInput.warrantyReport ?? submission.message}`; then `UPDATE attachments SET emotive_claim_id=<new>, client_submission_id=NULL, claim_kind='emotive' WHERE client_submission_id=id`; `markConverted`; audit; emit event. One transaction.
- [ ] `reject(actor, id, reason)`: `markRejected` + audit + emit event.
- [ ] Recipient resolver: `app_settings` key `client_submissions.notify_email` else constant `claims@mrgroup.rs`.
- [ ] **Test (integration):** create writes audit + invokes recording email port; convert creates an emotive claim, re-points a submission attachment to it, marks converted; reject marks rejected + audit. Non-linked user → Forbidden.
- [ ] Commit.

### Task 1.4 — controller + routes (thin, permission-gated) + DI + app wiring
**Files:** create `controller.ts`, `routes.ts`, `index.ts`; modify `core/container.ts`, `app.ts`. Mirror external-parties.
- [ ] Routes: `POST /api/client-submissions` `requirePermission('client_submissions.create')` + rate-limit 20/h/user; `GET /api/client-submissions?status=pending` `.manage`; `GET /api/client-submissions/:id` `.manage`; `POST /api/client-submissions/:id/convert` `.manage`; `POST /api/client-submissions/:id/reject` `.manage`. Validate `:id` with Zod. List response `{items,total,page,pageSize}`.
- [ ] **Test (http integration):** each route's happy path + a permission-denied (client hitting `.manage` → 403; cross-customer create scoping; 404 for non-owned where applicable per docs/05).
- [ ] Commit.

### Task 1.5 — attachments accept a submission target + serve-auth
**Files:** modify `apps/api/src/modules/attachments/{validators,service,routes}.ts`.
- [ ] Upload accepts `clientSubmissionId` as an alternative target (exactly one of the three). Store with `client_submission_id` set. Reuse the whole existing pipeline (MIME magic-byte, size limit, image optimize, storage).
- [ ] Serve/list auth: a `client_submissions.create` holder may view attachments of a submission **they** submitted (own-submission scope); operator/admin (`.manage`) may view any. Return 404 (not 403) for non-owned, per docs/05.
- [ ] **Test (integration):** client uploads to own submission + can read it back; another client gets 404; operator can read.
- [ ] Commit. **End of phase: full gate green.**

---

## Phase 2 — Portal submission

### Task 2.1 — shared query/mutation
**Files:** create `packages/shared/src/queries/client-submissions.ts`. Mirror `registration.ts`.
- [ ] `createClientSubmission()` mutation (`POST /api/client-submissions` → `{id}`). (No list query needed on the portal — minimal per decision #4.)
- [ ] Commit.

### Task 2.2 — portal form route
**Files:** create the portal route (authed layout) `apps/portal-web/src/routes/_authed/prijava.tsx`; add a "Prijavi problem" entry to the portal nav/dashboard.
- [ ] Form: `message` textarea (Razlog) + file upload (reuse the portal's existing attachment upload; upload after the submission id is returned). Submit → mutation → toast "Zahtev primljen" → back to `/claims`.
- [ ] Gate the entry behind the `client_submissions.create` permission (courtesy; server is the judge).
- [ ] **Test (web component):** renders, validates empty message, submits and shows the confirmation; upload wiring smoke test.
- [ ] Commit. **Full gate green.**

---

## Phase 3 — Internal Inbox

### Task 3.1 — inbox list query + wire `/pristiglo`
**Files:** create `apps/internal-web/src/features/inbox/*`; modify `pristiglo.tsx`, `navigation.ts`, add queryOptions to `packages/shared/src/queries/client-submissions.ts`.
- [ ] `pendingSubmissionsListOptions(page)` queryOptions. Route loader `ensureQueryData`; `useSuspenseQuery`; list component (firm · reason excerpt · time · attachment count) with empty/loading/error states. Replace the placeholder.
- [ ] Badge count on the Inbox nav item from the same query's `total`.
- [ ] **Test (web):** list renders rows + empty state; badge shows the count.
- [ ] Commit.

### Task 3.2 — detail + convert + reject
**Files:** `apps/internal-web/src/features/inbox/*` + a convert entry into the existing emotive create flow.
- [ ] Detail: full message + attachment previews/downloads. "Otvori reklamaciju" → opens the **existing** EMOTIVE create form pre-filled (`customerId` = submission firm, `warrantyReport` = message; attachments already carried on convert). On save, call convert. "Odbij" → `<ConfirmDialog>` with optional reason → reject.
- [ ] SSE: add the `client_submission` event type in `events`; `handle-app-event.ts` invalidates the inbox list + badge.
- [ ] **Test (web):** convert opens the pre-filled create form and calls convert on save; reject calls reject; SSE handler invalidates the right keys.
- [ ] Commit. **Full gate green.**

---

## Phase 4 — Email content + final verification

### Task 4.1 — notification email content + recipient setting
**Files:** `apps/api/src/modules/client-submissions/service.ts` (already sends in 1.3 — here finalize content + the `app_settings` override).
- [ ] Subject `Nova prijava — <firma>`; body = firm + reason excerpt + link to `/pristiglo`. From = configured `RESEND_FROM_EMAIL` (`auth.info@mrengines.global`). Recipient resolver as decided.
- [ ] **Test:** recording email port receives to/subject/body; app_settings override wins over the constant.
- [ ] Commit.

### Task 4.2 — full gate + verify
- [ ] `pnpm format:check && pnpm build && pnpm typecheck && pnpm lint && pnpm --filter api depcruise && pnpm test && pnpm test:integration` all green.
- [ ] Manual/`/verify`: client submits → appears in Inbox with badge + email fired → convert creates the EMOTIVE claim with attachments + Razlog → claim shows in the client's list. Reject path.
- [ ] Update `docs/18` status PREDLOG→DONE; fix the stale RESEND_FROM doc drift.

---

## Self-review (spec coverage)

- Submitter=logged-in client → Task 1.3 customer_users resolve + `create` perm. ✓
- Message+attachments → 1.1/1.5/2.2. ✓
- One-way → no reply endpoints. ✓
- Minimal client visibility → portal has only the create path (2.x); no tracker. ✓
- Kind-aware EMOTIVE convert → 1.3. ✓
- Email → 1.3/4.1. ✓
- Inbox badge + list + detail + convert/reject → Phase 3. ✓
- RBAC/SSE/audit → 0.2/1.3/1.4/3.2. ✓
- Message→warrantyReport → 1.3. ✓
- Out of scope (domestic first-class, conversation, client email) → not built. ✓
