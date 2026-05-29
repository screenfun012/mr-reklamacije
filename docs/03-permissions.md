# 03 — Permissions and RBAC

The authorization system is built on top of Better-Auth.
Better-Auth answers "who are you"; our RBAC layer answers "what may you do".

## Core principles

1. **Permissions are atomic and defined in code.** They never change at runtime.
   Adding a new permission requires a code change and a migration (trivial).
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
| `emotive_claims.unarchive` | Move a claim out of `archived` into `pending` (admin/senior only) |

### Module: `domace_claims` — DOMACE claims

| Permission | Description |
|---|---|
| `domace_claims.view` | See the DOMACE claims list and any single claim's details |
| `domace_claims.view_own_customer` | See DOMACE claims limited to customers the user is linked to |
| `domace_claims.create` | Create a new DOMACE claim |
| `domace_claims.update` | Edit an existing DOMACE claim |
| `domace_claims.delete` | Soft-delete |
| `domace_claims.restore` | Restore soft-deleted |
| `domace_claims.change_outcome` | |
| `domace_claims.unarchive` | |

### Module: `observations` — claim observations / internal notes

| Permission | Description |
|---|---|
| `observations.view_internal` | See internal observations on any claim |
| `observations.create_internal` | Add internal observations |
| `observations.create_client_visible` | Add observations visible to the client |
| `observations.edit_own` | Edit own observations (within 10 min of creation) |
| `observations.delete_own` | Delete own observations |
| `observations.delete_any` | Delete anyone's observations |

### Module: `attachments`

| Permission | Description |
|---|---|
| `attachments.view_internal` | See all attachments including internal-only |
| `attachments.upload` | Upload new attachments to a claim |
| `attachments.delete_own` | Delete own uploads |
| `attachments.delete_any` | Delete any attachment |
| `attachments.change_visibility` | Toggle between internal and client-visible |

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

### Module: `import`

| Permission | Description |
|---|---|
| `import.legacy_excel` | Run the one-time historical Excel ETL import |

### Module: `users`

| Permission | Description |
|---|---|
| `users.view` | View user list |
| `users.create` | Create new user accounts |
| `users.update` | Edit user profile (name, email, language) |
| `users.deactivate` | Deactivate user (disables login but preserves history) |
| `users.delete` | Soft-delete |
| `users.reset_password` | Trigger password reset for another user |
| `users.manage_2fa` | Enable/disable 2FA for other users |
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

### Module: `translation`

| Permission | Description |
|---|---|
| `translation.request` | Trigger OpenAI translation of a text block |
| `translation.manage_cache` | Clear translation cache |

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
domace_claims.view
domace_claims.create
domace_claims.update
domace_claims.change_outcome
observations.view_internal
observations.create_internal
observations.create_client_visible
observations.edit_own
observations.delete_own
attachments.view_internal
attachments.upload
attachments.delete_own
attachments.change_visibility
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
translation.request
```

### `viewer`

Read-only internal access. Can see everything an operator can, but modifies nothing.

Permissions:
```
emotive_claims.view
domace_claims.view
observations.view_internal
attachments.view_internal
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

### `client`

External client. Sees only their own customer's claims, through the portal.

Permissions:
```
emotive_claims.view_own_customer
domace_claims.view_own_customer
observations.view_client_visible   (implicit via view_own_customer; we do NOT grant view_internal)
attachments.view_client_visible    (implicit)
export.own_claims
translation.request
```

**Important:** `client` role does NOT have `observations.view_internal` or
`attachments.view_internal`. The repository layer filters those by `visibility = 'client_visible'`
when the requesting user's effective permissions do not include the internal-view variant.

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
