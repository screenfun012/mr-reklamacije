# 03 — Permissions and RBAC

The authorization system is built on top of Better-Auth.
Better-Auth answers "who are you"; our RBAC layer answers "what may you do".

## Core principles

1. **Permissions are atomic and defined in code.** They never change at runtime.
   The catalog in `@mr/shared` is the truth: `db:seed` inserts what is new and prunes what is
   gone (with the role grants that held it), so no migration is involved. A permission that no
   code checks fails `permission-enforcement.test.ts` — the catalog cannot run ahead of the app.
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
| `employees.view_analytics` | See trading-style employee analytics (ratios, trends) |
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

1. On login, user's effective permissions are computed and stored in Better-Auth session.
2. Cookie cache is valid 5 minutes; during that time API avoids DB query for permissions.
3. When admin modifies `role_permissions` or `user_roles`:
   - API writes to DB
   - API calls `permissions.invalidateFor(userIds)` — clears Redis/memory cache (none; we use per-request refetch)
   - API emits SSE event `{ type: 'permissions_changed' }` to every affected user's SSE channel
4. Affected users' browsers receive SSE → invalidate TanStack Query `['me']` → refetch → UI updates

See `docs/05-auth-realtime.md` for the complete SSE architecture.

### Forcing logout on role change

If a role change removes **all** access to a panel the user is currently on
(e.g., employee was demoted to client), the server sends `{ type: 'session_invalidated' }`
which forces a redirect to login. Client-side it's a `window.location.href = '/login'`.

---

## Custom role workflow (admin UI)

1. Admin opens "Role" page, clicks "New role"
2. Modal: role code (slug), name (sr/en), description
3. Permission tree: expandable by module, checkbox per permission
4. "Copy from existing role" button: pre-fills checkboxes based on a chosen role
5. Save → writes `roles` + `role_permissions` rows + audit log entry
6. Edit: same tree with pre-filled state. Diff is computed for audit log.
7. Delete: only for `is_system = false` roles; cascade detaches `user_roles`.

### Validation

- Role `code` must match `^[a-z][a-z0-9_]{2,32}$`
- Cannot delete a role that still has users assigned (admin must re-assign first; UI warns)
- Cannot create a role named with reserved system codes: `admin`, `operator`, `viewer`, `client`

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
