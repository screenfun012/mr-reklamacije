# 03 — Permissions and RBAC

The authorization system is built on top of Better-Auth.
Better-Auth answers "who are you"; our RBAC layer answers "what may you do".

## Core principles

1. **Permissions are atomic and defined in code.** They never change at runtime.
   The catalog in `@mr/shared` is the truth: `db:seed` inserts what is new and prunes what is
   gone (with the role grants that held it), so no migration is involved. A permission that no
   code checks fails `permission-enforcement.test.ts` — the catalog cannot run ahead of the app.

   ⚠ **The prune stops rather than guesses.** It compares the database against the catalog of the
   build that is RUNNING, and three different things look identical from there: a genuine
   retirement, a rollback to an older image, and a renamed permission id. When the deletion would
   remove a grant a **live** role still holds, the seed refuses, prints each code with the sets
   that hold it, and rolls everything back — `pnpm --filter @mr/db run db:seed -- --prune` is the
   confirmation. An orphan row no live set grants is deleted without asking, so an ordinary seed
   still needs no flag. `runSystemSeeds` runs in **one transaction** for exactly this reason: two
   of its steps delete and two throw, and step-by-step a refusal would commit the deletions and
   abandon the rest.
2. **Roles are defined in the database.** Admin can create, edit, and delete custom roles.
3. **A user has one or more roles.** Effective permissions = union of all role permissions.
4. **System roles cannot be deleted or renamed.** They can be edited only to the extent
   of which custom-added permissions they have, but the built-in minimum per role is locked.
5. **The server is the judge.** UI hiding is a courtesy; every API route enforces its own permission check.
6. **Permission changes propagate in near real-time** via SSE (see `docs/05-auth-realtime.md`).

## Permission naming convention

Format: `<module>.<action>` or `<module>.<sub_module>.<action>`.

Actions standardized across modules: `view`, `create`, `update`, `delete`, `restore`, `export`, `import`, `manage`.
`manage` implies all CRUD actions on a shifarnik-like resource.

---

## Complete permission catalog

### Module: `emotive_claims` — EMOTIVE claims

| Permission | Description |
|---|---|
| `emotive_claims.view` | See the EMOTIVE claims list and any single claim's details |
| `emotive_claims.view_own_customer` | See EMOTIVE claims limited to customers the user is linked to via `customer_users` |
| `emotive_claims.create` | Create a new EMOTIVE claim |
| `emotive_claims.update` | Edit an existing EMOTIVE claim |
| `emotive_claims.delete` | Soft-delete an EMOTIVE claim |
| `emotive_claims.restore` | Restore a soft-deleted EMOTIVE claim |
| `emotive_claims.change_outcome` | Change the outcome (pending/accepted/rejected/archived) |
| `emotive_claims.publish` | Publish a claim to the client portal — Gate B, reveals the real (masked) outcome (operator, admin) |

### Module: `domace_claims` — DOMACE claims

| Permission | Description |
|---|---|
| `domace_claims.view` | See the DOMACE claims list and any single claim's details |
| `domace_claims.view_own_customer` | See DOMACE claims limited to customers the user is linked to |
| `domace_claims.create` | Create a new DOMACE claim |
| `domace_claims.update` | Edit an existing DOMACE claim |
| `domace_claims.delete` | Soft-delete |
| `domace_claims.restore` | Restore soft-deleted |
| `domace_claims.change_outcome` | Change the outcome (pending/accepted/rejected/archived) |

### Module: `attachments`

| Permission | Description |
|---|---|
| `attachments.view_internal` | See all attachments including internal-only |
| `attachments.upload` | Upload new attachments to a claim |
| `attachments.delete_own` | Delete own uploads |
| `attachments.delete_any` | Delete any attachment |
| `attachments.change_visibility` | Toggle between internal and client-visible |

### Module: `client_submissions` — client portal ticket intake

| Permission | Description |
|---|---|
| `client_submissions.create` | Client submits a request (reason + attachments) from the portal |
| `client_submissions.manage` | View, convert to a claim, or reject client submissions in the internal Inbox |

### Module: `intake_orders` — vehicle service intake (docs/25)

| Permission | Description |
|---|---|
| `intake_orders.view` | View every intake order in the shop |
| `intake_orders.view_own` | View only the caller's own intake orders (a foreign row 404s, never 403) |
| `intake_orders.create` | Start a new intake |
| `intake_orders.update` | Fill the wizard in, and edit services/materials/the added contact number afterwards |
| `intake_orders.advance` | Step the status forward one notch (the serviser's one-way button) |
| `intake_orders.change_status` | Set any status — correcting a mis-tap, office only |
| `intake_orders.delete` | Discard another serviser's unfinished draft (a signed order can no longer be removed by anyone — docs/25 §3.0.1) |

⚠️ **`intake_orders.amend` was removed on 2026-08-11** (the signature now freezes the record, so
there is no amended state to permit). It never reached production; in dev and test its
`role_permissions` row is left as an orphan on purpose.

Intake photos are served by the intake module under these permissions, **not** by
`attachments.*` — a serviser must never hold a permission that would also reach a claim's files.

### Module: `claim_reports`

| Permission | Description |
|---|---|
| `claim_reports.view` | View the formal claim report editor content |
| `claim_reports.update` | Create and edit claim report content (autosave) |
| `claim_reports.export` | Export claim report to Word/PDF (Phase 3.2) |

### Module: `customers`

| Permission | Description |
|---|---|
| `customers.view` | View customer list and details |
| `customers.create` | Create new customer records |
| `customers.update` | Edit customer records |
| `customers.delete` | Soft-delete customer records |
| `customers.link_users` | Manage `customer_users` M:N mappings |

### Module: `employees`

| Permission | Description |
|---|---|
| `employees.view` | View employees list and profile |
| `employees.view_analytics` | See the figures that measure a **named person** — claims per assigned worker, and faults blamed on him. Withheld as `null` from the statistics summary without it; departments and external parties are not withheld, because they are places and not people. ⚠ **It guards the SCREEN only** — see the note below |
| `employees.create` | Create new employee records |
| `employees.update` | Edit employee records |
| `employees.deactivate` | Mark employee as terminated |
| `employees.delete` | Soft-delete |

### Module: `employee_output`

| Permission | Description |
|---|---|
| `employee_output.view` | View monthly assembly counts |
| `employee_output.update` | Enter/edit monthly assembly counts |

### Module: `statistics`

| Permission | Description |
|---|---|
| `statistics.view_emotive` | Access EMOTIVE statistics pages |
| `statistics.view_domace` | Access DOMACE statistics pages |
| `statistics.view_overall` | Access combined firm statistics (emotive + domace) |
| `statistics.view_financial` | See monetary figures in DOMACE stats |

### Module: `export`

| Permission | Description |
|---|---|
| `export.workbook_full` | Export the complete workbook (all sheets) |
| `export.workbook_partial` | Export partial workbook (by year, by market, by customer) |
| `export.own_claims` | Export only the claims the user has visibility into (for client portal) |

### Module: `users`

| Permission | Description |
|---|---|
| `users.view` | View user list |
| `users.create` | Create new user accounts |
| `users.update` | Edit user profile (name, email, language) |
| `users.deactivate` | Deactivate user (disables login but preserves history) |
| `users.delete` | Soft-delete |
| `users.reset_password` | Trigger password reset for another user |
| `users.approve_registration` | Approve client registration requests |
| `users.reject_registration` | Reject client registration requests |

### Module: `roles`

| Permission | Description |
|---|---|
| `roles.view` | View roles and their permissions |
| `roles.create` | Create new custom roles |
| `roles.update` | Edit custom role permissions; edit system role additions |
| `roles.delete` | Delete custom roles |
| `roles.assign` | Assign roles to users |

### Module: `settings` — shifarnici + app settings

| Permission | Description |
|---|---|
| `settings.departments.manage` | CRUD on departments |
| `settings.engine_types.manage` | CRUD on engine types |
| `settings.engine_types.create` | Create-only (for employees adding from claim form) |
| `settings.engine_manufacturers.manage` | CRUD on engine manufacturers (admin panel) |
| `settings.engine_manufacturers.create` | Create engine manufacturers (admin panel) |
| `settings.external_parties.create` | Create-only (inline from claim fault form; mirrors engine_types.create) |
| `settings.external_parties.manage` | CRUD on external parties |
| `settings.claim_sources.manage` | CRUD on claim sources |
| `settings.app_settings.view` | View app settings (excludes secrets) |
| `settings.app_settings.update` | Update app settings |
| `settings.app_settings.manage_secrets` | View and update secret values (API keys) |

### Module: `audit`

| Permission | Description |
|---|---|
| `audit.view` | Access audit log |
| `audit.export` | Export audit log entries |

---

## System roles (seeded, immutable code field)

### `admin`

Gets **all** permissions. Hard-coded at the resolver level — even if role_permissions
somehow becomes inconsistent, the admin code path bypasses the check.

### `operator`

Default internal employee. Full CRUD on claims, no deletes, no user management.

Permissions:
```
emotive_claims.view
emotive_claims.create
emotive_claims.update
emotive_claims.change_outcome
emotive_claims.publish
domace_claims.view
domace_claims.create
domace_claims.update
domace_claims.change_outcome
attachments.view_internal
attachments.upload
attachments.delete_own
attachments.change_visibility
intake_orders.view
intake_orders.view_own
intake_orders.create
intake_orders.update
intake_orders.advance
intake_orders.change_status
intake_orders.delete
claim_reports.view
claim_reports.update
customers.view
customers.create
customers.update
employees.view
employees.view_analytics
employee_output.view
employee_output.update
statistics.view_emotive
statistics.view_domace
statistics.view_financial
export.workbook_full
export.workbook_partial
settings.engine_types.create
settings.external_parties.create
```

### `viewer`

Read-only internal access. Can see everything an operator can, but modifies nothing.

Permissions:
```
emotive_claims.view
domace_claims.view
attachments.view_internal
claim_reports.view
customers.view
employees.view
employees.view_analytics
employee_output.view
statistics.view_emotive
statistics.view_domace
statistics.view_financial
export.workbook_full       (read is OK; no data modification)
export.workbook_partial
```

### `serviser`

Shop floor, tablet. Vehicle service intake and nothing else — no claims, no statistics,
no inbox. Uses internal-web, but with a single visible nav entry the sidebar is not
rendered at all, so his name and logout live in the topbar (docs/25 §3.1).

Permissions:
```
intake_orders.view_own
intake_orders.create
intake_orders.update
intake_orders.advance
```

**Deliberately absent:** `attachments.*` — intake photos are served by the intake module
under `intake_orders.view`/`view_own`, so this role can never reach a claim's files. Also
absent: `notifications.view_own`, until intake notifications get their own design pass.

### `client`

External client. Sees only their own customer's claims, through the portal.

Permissions:
```
emotive_claims.view_own_customer
domace_claims.view_own_customer
attachments.view_client_visible    (implicit)
export.own_claims
```

**Important:** `client` role does NOT have `attachments.view_internal`. The repository layer
filters attachments by `visibility = 'client_visible'` when the requesting user's effective
permissions do not include the internal-view variant.

---

### ⚠ `employees.view_analytics` guards the screen, not the Excel export

The workbook carries a sheet **`REKLAMACIJE PO ZAPOSLENOM`** — named workers, claim counts and
PROCENAT — added whenever the export includes EMOTIVE rows, behind `export.workbook_partial` alone.
It measures the same named people the statistics summary now withholds.

**Left open deliberately (Nikola, 2026-08-18)**, when this gap was found right after the gate was
built. His reason is a direction, not an oversight: the Excel export is meant to grow into
"export whatever we want about whatever we want" from the statistics screen, and gating individual
sheets on individual permissions would fight that the whole way. Machining will make the shape of it
concrete.

So the honest statement is: **a person given only the export actions can read per-worker figures the
screen would refuse them.** Written down here so nobody later reads the gate as complete and builds
on a wrong assumption. If the export is ever split by permission, this sheet is the first case.

## Standard privilege sets (seeded, `is_system = true`)

Beside the five coarse roles above the seed maintains **21 small, independent sets**
(`packages/db/src/seed/standard-roles.ts`). A person holds several and their actions add up —
`[Prijem — rad na terenu] + [Prijem — kancelarija] + [Slanje dokumenta]` instead of a role named
"Operater bez slanja". Three sets give eight combinations while three things are maintained; the
alternative (clone a role, remove one action) is how a system ends up with fifty roles nobody can
tell apart.

| Area | Sets |
|---|---|
| Prijem vozila | Prijem — rad na terenu · Prijem — kancelarija · Prijem — slanje dokumenta · Prijem — samo pregled |
| Reklamacije | Reklamacije — pregled · obrada · odluka o ishodu · šta klijent vidi · brisanje i arhiva |
| Kupci i radnici | Kupci — vođenje · Radnici — vođenje · Radnici — učinak |
| Brojke | Statistika · Statistika — novac · Izvoz u Excel |
| Portal i sanduče | Pristiglo — prijave klijenata · Obaveštenja |
| Kontrolna tabla | Korisnici — pregled · Šifarnici — reklamacije · Šifarnici — prijem · Istorija |

Two rules govern them, and both are under test
(`packages/db/src/__tests__/integration/standard-roles-seed.integration.test.ts`):

- **The seed keeps a standard set equal to what the code says.** It inserts what is missing and
  **removes what code never granted** — add-only could not express a set, and an action taken out of
  a package here would keep being handed out by every database that had already seen it.
- **The seed never touches a set built in the panel** (`is_system = false`). That one belongs to its
  author; syncing it would silently undo his work on every deploy.

Because they are `is_system`, the panel offers **copying** rather than editing (`RolesService.assertEditable`).

**Deliberately not sets — admin only** (Nikola, 2026-08-17, after the demo: handing out rights stays
with the super-admin account): `users.reset_password` (it sets somebody else's password outright),
`users.create`/`delete`, every `roles.*`, `roles.assign`, `users.approve_registration` /
`reject_registration` + `customers.link_users` (approving a person gives him a role, so it gives him
rights), `users.deactivate`, and `settings.app_settings.view`/`update`/`manage_secrets`. The seven
portal actions are not sets either — `view_own_customer` is not "sees less" but "sees the rows of his
own firm", and a person from the firm has no firm.

Full design: `docs/superpowers/specs/2026-08-17-roles-admin-panel-design.md`.

## Permission check flow

### On the API

```ts
// Middleware factory
function requirePermission(perm: Permission) {
  return async (c: Context, next: Next) => {
    const user = c.get('user')
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const effective = await permissions.getEffectiveForUser(user.id)
    if (!effective.has(perm)) {
      audit.log({
        entity_type: 'permission_check',
        entity_id: user.id,
        action: 'denied',
        context: { permission: perm, route: c.req.path }
      })
      return c.json({ error: 'Forbidden' }, 403)
    }
    await next()
  }
}
```

Every protected route uses this. No exceptions.

### Row-level filtering (for `view_own_customer`)

```ts
// In repository
async list(user: AuthUser, filters: ClaimFilters) {
  const hasFull = user.permissions.has('emotive_claims.view')
  const hasOwn = user.permissions.has('emotive_claims.view_own_customer')

  let query = db.select().from(emotiveClaims).where(isNull(emotiveClaims.deletedAt))

  if (hasFull) {
    // no customer filter
  } else if (hasOwn) {
    const allowedCustomerIds = await this.getUserCustomerIds(user.id)
    if (allowedCustomerIds.length === 0) return []
    query = query.where(inArray(emotiveClaims.customerId, allowedCustomerIds))
  } else {
    throw new ForbiddenError()  // should never reach here if route middleware is correct
  }

  // apply other filters...
  return query
}
```

### On the UI

```tsx
function useCan(...perms: Permission[]): boolean {
  const { data: me } = useMe()
  return me ? perms.every(p => me.permissions.includes(p)) : false
}

// Component
function ClaimRow({ claim }) {
  const canDelete = useCan('emotive_claims.delete')
  const canEdit = useCan('emotive_claims.update')
  return (
    <tr>
      {/* ... cells ... */}
      <td>
        {canEdit && <EditButton />}
        {canDelete && <DeleteButton />}
      </td>
    </tr>
  )
}
```

Never gate an entire route purely via UI. Route layouts also check permissions
and redirect to `/403` if the user lacks access.

---

## Permission cache and invalidation

> Rewritten 2026-08-18 after tracing the code. What stood here described machinery that does not
> exist — `permissions.invalidateFor(userIds)`, an SSE event `permissions_changed`, and a UI that
> refetches `['me']` on it. None of those are real: the two event names appear once, inside a
> **comment** in `packages/shared/src/constants/app-events.ts`, and nothing defines, emits or
> listens to them. Believing that section would lead someone to skip a cache clear on the grounds
> that "the SSE will fix it".

**Permissions are not stored in a session.** `customSession`
(`packages/auth/src/better-auth.config.ts`) recomputes them on **every** `getSession`: it reads
`user_roles` fresh, then asks `cachedByRoles.resolveForRoles(roleCodes)`. Better-Auth's cookie cache
is deliberately **off** (`packages/auth/src/options.ts`), so every request really does reach the
database for the session row.

That resolver cache (`packages/auth/src/server/permission-cache.ts`) is a **module-level Map**, TTL
5 minutes, keyed by the caller's sorted role codes — not by user. So two people holding the same
combination share one entry.

When a set changes, `RolesService.applyImmediately` does two things:

1. **`clearPermissionCache()`** — empties that Map. This is what makes the change immediate: the
   very next request from anybody re-reads `role_permissions` from the database, and the
   `user.permissions` handed to the browser is rebuilt with it.
2. **`revokeUserSessions()`** for every holder — deletes their session rows, so their next request
   is a 401 and they are sent to the login screen.

⚠ **The spec's stated reason for step 2 is wrong** and the design doc has been corrected: it said
that without it "a person keeps a removed right for up to seven days". Seven days is the session
lifetime, not the permission lifetime — step 1 alone already takes the right away on their next
request, in both the server's check and the browser's copy. Step 2 ships because the spec asks for
it and because a person whose rights changed under them should come back through the door; it is
not what makes the change take effect. State it truthfully, or somebody eventually skips the cache
clear believing the session holds the answer.

Its cost is real and worth remembering: everyone holding the set is signed out mid-work. Revisit if
that ever bites; do not remove it in passing.

⚠ **Neither step crosses a replica.** The Map is per process, so with more than one API instance a
change reaches only the instance that served the PATCH; the others keep answering from their own
cache for up to 5 minutes, and a fresh login does not help because it lands on that instance's cache
too. `numReplicas` is 1 today and CLAUDE.md already lists this cache among the multi-replica
blockers — this is the concrete shape of that blocker.

### Forcing logout on role change

If a role change removes **all** access to a panel the user is currently on
(e.g., employee was demoted to client), the server sends `{ type: 'session_invalidated' }`
which forces a redirect to login. Client-side it's a `window.location.href = '/login'`.

---

## Custom privilege workflow (admin UI)

> Rewritten 2026-08-18 against the screen that shipped (R-5). What stood here described a different
> product: a "New role" button, a typed role code, a "copy from existing" button that pre-fills
> checkboxes, and a delete that detaches `user_roles`. None of that is what exists.

**Admin → Ovlašćenja** (`apps/admin-web/src/components/roles/`).

1. The list shows every set: name, **STANDARDNO / TVOJE**, how many actions it carries, how many
   people hold it.
2. **There is no "start from nothing".** Every set begins as a copy — `Umnoži` on any row, standard
   or custom. With 21 standard packages on the list, a copy is a shorter road to something sensible
   than an empty matrix of 84 checkboxes. `POST /api/roles/:id/duplicate` creates the copy
   immediately; it does not pre-fill a form.
3. **The code is never typed.** `RolesService.roleCodeFrom` derives it from the English name
   (transliterating `č ć ž š đ`, non-alphanumerics to `_`, capped at 40 chars), and `freeCodeFor`
   appends `_2`, `_3`… until it is free. So a name colliding with a reserved code is **not refused**
   — it simply gets a different code. Only the two names are validated: trimmed, 2–80 characters.
   Two sets may share a display name.
4. **Edit** opens the same dialog: names, description, and the action matrix grouped by `module`
   with "Sve"/"Ništa" per group. A standard set opens **read-only** with the line that says to copy
   it — `assertEditable` refuses the PATCH regardless.
5. **Save** writes `roles` + `role_permissions` in one transaction, audits the before/after, clears
   the permission cache and revokes the holders' sessions (see §Permission cache and invalidation).
6. **Delete is refused while anybody holds the set** — the button is dead and the count stands
   beside it. It is a **soft** delete (`deleted_at`); nothing is detached and no cascade runs,
   because a set can only be deleted when no `user_roles` row points at it. The resolver filters
   `deleted_at IS NULL`, so a deleted set stops granting immediately even to a live session.

### What the screen refuses, and where it is judged

Every refusal below is drawn on the screen **and** judged again on the server — the screen is
courtesy.

| Refusal | Server |
|---|---|
| A standard set cannot be edited | `RolesService.assertEditable` → 422 |
| A set somebody holds cannot be deleted | `RolesService.softDelete` → 409 with the count |
| An action the actor does not hold cannot be **added** | `RolesService.assertActorHolds` → 403 |

⚠ That last one is about **adding** only. An action already in a set may always be taken away —
removing is never an escalation, and forbidding it would leave a set nobody can shrink once its
author lost the action. The checkbox is dead only when it is OFF and unheld.

⚠ Today **no checkbox is ever dead**: admin-web is admin-only and `admin` holds every action from
the resolver's bypass. The rule is built for the day part of this is delegated.

---

## Examples of permission combinations in practice

| Scenario | Roles assigned | Resulting access |
|---|---|---|
| Shop manager | `operator` | Full internal operational access |
| Shop owner | `admin` | Everything |
| Office visitor / auditor | `viewer` | Read-only internal |
| MRT POLSKA contact | `client` + `customer_users` → MRT POLSKA | Sees only MRT POLSKA claims |
| MR GROUP manager | `client` + `customer_users` → {MR ENGINES, MRT POLSKA} | Sees claims from both |
| Senior operator (custom) | `operator` + custom role with `emotive_claims.delete` | Full operator + can delete emotive claims |
| Financial auditor (custom) | `viewer` + custom role with `audit.view` | Read-only + audit log access |

---

## Defense in depth

Even though the API enforces permissions, we apply **redundant checks**:

- **Database-level:** none (Postgres roles are overkill here)
- **API middleware:** primary enforcement
- **Route loader:** TanStack Start loaders also check permissions before rendering
- **Component-level:** UI hides controls the user can't use
- **Audit log:** every denied action is logged for forensic review

This layered approach means a bug at any single layer does not compromise security.

---

## OPEN — roles must be reorganised once vehicle intake is finished (Nikola, 2026-08-12)

**Deferred by Nikola until the intake module is done.** Recorded here in his own words, so the
conversation starts from what he actually said rather than from a paraphrase:

> „Kada završimo servis vozila moramo da popričamo o rolovima kao i time kako ćemo da sredimo taj
> deo jer ovako stvari polako gube smisla. Najgora stvar koja mi je kliknula tu što se tiče rolova
> jeste što možda neki rolovi se poklapaju — u smislu možda mora da radi prijemno ali vidi
> reklamacije, ili radi reklamacije ali vidi prijemno, ili da edituje i jedno i drugo. Što znači da
> admin panel u ovom slučaju moramo da sredimo, jer hoću odatle da regulišem ovo i da nameštam
> rolove korisnicima kako treba."

### What he is describing, in this system's terms

The intake module added a **third axis of work** (prijem / servis) beside the two claim families, and
the role names stopped describing what a person actually does. Someone may need to _do_ intake while
only _seeing_ claims, or the reverse, or edit both. Today that combination has no name.

### What already exists and must not be re-invented

- **Permissions are atomic and defined in code** (`@mr/shared` `permissions.ts`); **roles live in the
  database**, and effective permissions are the union of a user's roles. That model already supports
  the overlap he describes — a user may hold several roles at once.
- **Custom roles are already a documented case** — see "Senior operator (custom)" in the table above.
- Admin already has a roles surface. What is unproven is whether it can express these combinations
  comfortably, and whether the intake permissions are grouped legibly there.

So the likely work is **not a new permission model**. It is: naming the intake axis properly,
auditing which permissions exist for it, and making the admin screen good enough to compose them —
`docs/13` ("admin is the control plane") applied to a module that grew after it was written.

### Why this is written down instead of started

His own reason, from the same message: information arriving in pieces and the direction changing
mid-build is what he is tired of. Roles touch every module, so they get their own conversation with
the whole picture in view — after intake, and before the engine-without-a-car work (`docs/25` §9.4),
which will add a fourth kind of thing a person can be allowed to see.
