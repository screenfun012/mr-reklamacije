# docs/19 — Whole-system audit & prioritized improvement plan

> **Status: PROPOSAL (2026-07-14).** Read-only audit across 6 dimensions (security, performance,
> stack best-practices, Railway/infra, scalability, clean code) via parallel specialist agents, with
> adversarial verification of the security finding. Nothing implemented — this is a backlog for
> Nikola to prioritize. Headline: **the codebase is mature and clean; no P0/critical issues; the new
> ticket feature is well-hardened.** The items below are real improvements, not fires.

**Verification note:** only the security finding was independently adversarially re-checked (it holds,
but severity corrected P1→P2 — see below). The rest are high-confidence, file-cited findings from the
audit agents; each risky one will be re-verified at implementation time before any change.

---

## P1 — do soon (real risk / mandated)

1. **Attachments have NO offsite backup after the MinIO cutover (data-loss risk).** Pre-cutover, `/data` rsynced nightly to Synology; the cutover deleted `/data` and put all attachments on one MinIO volume with no backup job (docs/17 §8 punts on it). Attachments = primary claim evidence. → Add a nightly `mc mirror`/`aws s3 sync` of the `attachments` bucket to Synology (mirror the existing `pg_dump` cron) + confirm Railway volume snapshots on MinIO. Effort M. *(Highest real risk in the whole audit.)*
2. **No HTTP security headers anywhere (CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy).** Mandated by `.cursor/rules/05` + listed unfinished in docs/12; verified genuinely absent. Auth/authz + host-only cookie isolation are intact, so **not critical (verified P2)** — but it's a missing defense-in-depth layer (clickjacking on the portal, no CSP to contain future XSS). → `hono/secure-headers` on the API + the same headers (esp. `X-Frame-Options`/`frame-ancestors` + CSP) on the 3 SPA document responses via Nitro `routeRules`. CSP decided with Nikola (SSR needs `style-src 'unsafe-inline'`; portal needs `img-src data:`). Effort M. No auth/migration touch.

## Quick wins — small effort, high value

3. **Set `ATTACHMENT_SIGNING_SECRET`** (dashboard): a ≥32-char value distinct from `BETTER_AUTH_SECRET`, so the quarterly auth-secret rotation stops silently invalidating attachment URLs. Effort S.
4. **Batch the portal attachment upload:** the report form uploads files one-request-at-a-time sequentially; the server already accepts a `files` array (`readUploadFiles`). Compress in parallel + one multipart POST → N+1 round-trips become 2. Effort S.
5. **Don't `await` the best-effort notification email** before returning the submission id — it adds latency for a result the client never sees; it's already try/catch'd and the submission is durably in the Inbox. Fire-and-settle. Effort S.
6. **Soft-delete submission attachments on reject:** `reject()` only flips status; the uploaded media keeps living in MinIO forever (unbounded growth). Soft-delete them in the reject transaction so a GC sweep can reclaim. Effort S.
7. **Add `watchPatterns` to the 3 web `railway.json`** (they have none → every push redeploys all three). Scope each to `apps/<app>/**`, `packages/**`, `tooling/**`, root manifests. Effort S. *(Note: the api watchPatterns ALREADY cover `packages/**` + `scripts/**` — the earlier "db-only change won't deploy api" worry was wrong; the real over-deploy is the web apps.)*
8. **Dashboard verification checklist (owner):** EU (Amsterdam) region on all services; api RAM ≥1 GB (PDF export OOMs below); `*.up.railway.app` disabled on the 3 web services (else `CF-Connecting-IP` is forgeable → breaks rate-limit + audit IP integrity); Railway snapshots + Synology `pg_dump` cron actually running + test-restored; keep `API_REPLICA_COUNT=1` (SSE + in-memory rate-limit fragment at >1 replica).

## Robustness / quality — medium effort

9. **Run the API container as non-root.** It parses untrusted uploads + drives headless Chromium as root. The MinIO cutover removed the `/data` volume (the blocker CLAUDE.md cited), so it's cheap now: set `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` + `USER node`, verify a PDF still renders. Effort M.
10. **Add error tracking/alerting** (currently only a liveness ping — a 500-spike on one endpoint is invisible). Sentry free tier at the Hono error boundary + browser apps, or a log/`audit_log`-based alert. Optional-via-env like OPENAI/RESEND. Effort M.
11. **Verify the API↔client type boundary.** `fetchJson<T>` is a blind `as T` cast; controllers hand-parse. Low-churn win now: `.parse()` responses through the Zod schemas that already sit unused beside the query factories → drift fails loudly at the boundary. (Higher-churn `@hono/zod-validator` + `hc` RPC client = its own approved task later.) Effort M.
12. **De-duplicate + de-god the attachment code:** the download-serving orchestration (cache/ETag/304) is copy-pasted across 2 controllers + 2 service methods (cache-correctness drift risk); and `attachments.service.ts` is a 744-line god file (>500 rule) after absorbing the submission methods. → Extract one `serveCachedAttachmentDownload` helper + split the submission methods into a `SubmissionAttachmentsService`. Effort S+M.
13. **Pending-inbox index + cheap badge:** add a partial index `(created_at desc) WHERE status='pending' AND deleted_at IS NULL` (migration), and give the nav badge a dedicated `pending-count` endpoint instead of fetching 20 full rows + subqueries for one integer. Effort S+M.

## Scalability insurance — do at the right moment, not now

14. **Extract a claim-family registry BEFORE building machining.** Per-kind UNION branching is hand-duplicated across ~7 sites (claims list, 4 stats methods, dashboard, Excel); docs/16 admits machining touches ~7 places. Drive them off one registry loop first → the 3rd family is one entry, not N edits. Effort L. *(Do as step 1 of the machining work.)*
15. **Domestic customers first-class** (blocks DOMACE portal clients + submissions). Keep it a deliberate separate project; when scoped, prefer an **additive nullable `customer_id` FK** on `domace_claims` (keep `customer_name` as fallback) so the kind-aware convert() + scoping light up with zero union-code rework. Know-it's-there.
16. **UUID v7 for the new machining tables** at creation (free locality win, no migration) — decide once at M-1; update the known-drift note either way.
17. **Custom-outcomes registry** when that Phase-2 project is tackled (outcome referenced in ~126 files) — centralize into one `@mr/shared` registry like the existing badge-color maps. Know-it's-there.
18. Offset→keyset pagination on the claims UNION (when it becomes the p95 bottleneck) — thread the cursor through the same registry refactor (#14). Async job queue only when the first genuinely-async feature lands (don't add Redis speculatively).

## Minor polish (P3)

19. Portal report form → use `useMutation` (matches `use-convert-submission`) instead of hand-rolled `useState` + try/catch. · Derive repo insert/row types from Drizzle `$inferInsert`/`$inferSelect`. · Decide the unused `relations()` blocks (drop or adopt `db.query.*`). · Add a `--color-mrp-bad-border` token (report form uses a raw rgba). · Convert-button `✓` glyph → lucide `<Check>`.

## Stale docs to fix alongside

`docs/11` still describes the pre-MinIO `/data` volume + omits the six `S3_*` env vars (a half-followed runbook would brick a fresh deploy) → rewrite to match docs/17. `docs/08`/`docs/11` volume-backup sections likewise.
