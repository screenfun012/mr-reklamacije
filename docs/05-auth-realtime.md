# 05 — Authentication and Real-time

## Authentication stack

- **Better-Auth** v1+ — session management, password login, email verification, TOTP 2FA
- **Custom RBAC** layered on top (see `docs/03-permissions.md`)
- **Custom client registration** flow (see below)

## Session model

- **Strategy:** server-side sessions with opaque session cookie
- **Cookie cache:** 5 minutes — session data cached in cookie as encrypted JWE
- **Absolute lifetime:** 7 days
- **Idle timeout:** varies by role (see below)
- **Cookie attributes:** `HttpOnly; Secure; SameSite=Lax; Path=/`
- **Cookie name:** `mrr.session_token`

### Per-role idle timeout

| Role | Idle timeout |
|---|---|
| `admin` | 30 minutes |
| `operator` | 4 hours |
| `viewer` | 4 hours |
| `client` | 30 days ("remember me" behavior for portal) |

Implemented via `beforeSignIn` hook in Better-Auth that sets `session.expiresIn` based on user's primary role.

---

## Registration flows

### Internal users (admin, operator, viewer)

**Only admin can create internal users.** No self-signup endpoint is exposed
on `interno.mrengines.rs` or `admin.mrengines.rs`.

Flow:
1. Admin in admin panel → "Users" → "New user"
2. Fills: email, name, initial role(s), preferred language
3. Server creates user with a random 32-char password, generates a password
   reset token, and emails it to the user
4. User clicks link → sets their own password → logs in
5. On first login, user is prompted to enable 2FA (optional for operator/viewer,
   forced for admin)

### Clients

**Self-registration allowed on portal,** admin must approve.

Flow:
1. Client visits `reklamacije.mrengines.rs` → "Register"
2. Form: name, email, phone, company name, preferred language, message to admin, password
3. POST to `/api/auth/register-client` — writes to `client_registration_requests` with `status='pending'`
4. Email to admin: "New registration request"
5. Admin in admin panel → "Registration requests" → opens one
6. Admin chooses action:
   - **Approve** → selects/creates `customer` record → links via `customer_users` →
     creates `users` row → sets `role='client'` → sends welcome email to client
   - **Needs info** → custom message → email to client
   - **Reject** → optional reason → email to client
7. Client receives email → logs in with password they set at registration

Rate limit on `/api/auth/register-client`: **3 requests per hour per IP**
(Cloudflare rule + Better-Auth built-in).

> **Note (reality, post-`0016`):** alongside the `client_registration_requests`
> flow above, the schema now also has `users.account_status`
> (`pending`/`approved`/`rejected`, migration `0016`). The user-approval path
> assigns the `operator` role on approval (protected super-admin excluded) and
> revokes sessions on deactivation. Treat `account_status` as the newer, active
> mechanism; the registration-requests flow above is the original design.

---

## Password policy

| Role | Min length | Requires |
|---|---|---|
| `admin` | 12 | upper + lower + digit + symbol |
| `operator`, `viewer` | 10 | upper + lower + digit |
| `client` | 8 | upper + lower + digit |

Validation in Zod schema, enforced both client and server side.
Password strength meter (zxcvbn) shown on registration and password change forms.

## 2FA

- **Forced** for `admin` role
- **Optional** for all others (user can enable from profile page)
- **TOTP only** (Google Authenticator, Authy, 1Password, etc.) — no SMS
- **Backup codes** — 10 one-time codes generated at 2FA setup, user stores safely
- **Recovery** — if user loses device and backup codes, another admin can reset 2FA
  (logged in audit)

## Login flow

1. User submits email + password
2. Server validates credentials via Better-Auth
3. If 2FA enabled, returns `{ twoFactorRequired: true }` — client shows TOTP input
4. User submits TOTP code → server verifies → session created
5. Session cookie set (HttpOnly, Secure, SameSite=Lax)
6. Browser redirected to the app's home

On login, server records:
- `users.last_login_at`
- `users.last_login_ip`
- Row in `audit_log` with action `login`

## Logout flow

1. Click logout → POST to `/api/auth/logout`
2. Server deletes session from DB
3. Server responds with cookie-clearing header
4. Client closes any open SSE connection
5. Browser redirected to `/login`

---

## Permission resolution

When request hits API:

```
1. Auth middleware extracts session cookie → validates → attaches user to context
2. Permission middleware:
   - If cookie cache fresh (< 5 min), read permissions from cached user
   - Else, query DB for user's roles + role_permissions, build Set, attach
3. Route handler runs
4. Response sent; cookie cache refreshed if it was re-fetched
```

### Caching strategy

- **In-memory LRU** per API instance for permission Sets, keyed by `user.id`, TTL 60s
- Invalidated explicitly on `invalidateFor(userId)` calls (triggered by role changes)
- Since we run a single API instance, no distributed cache needed
- If we ever scale to multiple instances, a Postgres NOTIFY / Redis pub-sub can broadcast invalidations

### Admin bypass

The `admin` role is handled as a special case:

```ts
async function getEffectivePermissions(userId: string): Promise<Set<Permission>> {
  const roles = await getUserRoles(userId)
  if (roles.some(r => r.code === 'admin')) {
    return ALL_PERMISSIONS  // hard-coded set, never relies on DB role_permissions integrity
  }
  return new Set((await getPermissionsForRoles(roles.map(r => r.id))))
}
```

This ensures admin access is never broken by a data bug.

---

## Real-time propagation via SSE

### Why SSE over WebSockets

- One-way server-to-client traffic is all we need
- Uses plain HTTP — no special proxy config, passes through Cloudflare trivially
- Automatic reconnection handled by browser's `EventSource`
- Simpler than WebSocket lifecycle management
- Hono has first-class streaming support

### SSE endpoint

```
GET /api/events/me
```

- Requires authenticated session
- Server holds connection open (streaming)
- Sends `data: <json>\n\n` on events
- Sends `:heartbeat\n\n` every 20 seconds to keep connection alive through proxies

### Event types

Server → client events:

| Event | Payload | When sent |
|---|---|---|
| `session_invalidated` | `{ reason: string }` | User deactivated, session revoked, or lost all access to current panel |
| `permissions_changed` | `{ addedCount: number, removedCount: number }` | User's roles or role permissions changed |
| `claim_updated` | `{ kind, id }` | Someone else edited a claim currently open in user's UI |
| `claim_created` | `{ kind, id }` | New claim created (for live list refresh) |
| `claim_deleted` | `{ kind, id }` | Claim soft-deleted |
| `attachment_added` | `{ claimKind, claimId, attachmentId }` | Someone uploaded a file to a claim user is viewing |
| `observation_added` | `{ claimKind, claimId, observationId }` | Someone added an observation |
| `registration_request_new` | `{ requestId }` | Admin-only: new client registration pending |
| `export_ready` | `{ jobId, url }` | Long-running export completed |

### SSE cache invalidation rule (locked)

SSE events carry **only a signal** (`type` + `kind` + `id`) — never full entity
payloads. On receipt, the client calls `invalidateQueries` (e.g.
`emotiveClaimKeys.lists()` / `.detail(id)`); TanStack Query refetches only
active queries. Use `placeholderData: keepPreviousData` on list queries so the
table stays visible while refetch runs. **Never** write fetched rows into the
cache manually from SSE — the server is the single source of truth.

*Why:* pushing partial payloads through SSE duplicates server logic, causes stale
merges, and races with in-flight mutations; invalidation keeps one fetch path.

### Event bus architecture

In-process `EventEmitter`-based pub/sub. One instance per API process.

```ts
// event-bus.ts
class EventBus {
  private emitter = new EventEmitter()

  publishToUser(userId: string, event: AppEvent) {
    this.emitter.emit(`user:${userId}`, event)
  }

  publishToRole(roleCode: string, event: AppEvent) {
    this.emitter.emit(`role:${roleCode}`, event)
  }

  publishToAllAdmins(event: AppEvent) {
    this.publishToRole('admin', event)
  }

  subscribeUser(userId: string, listener: (event: AppEvent) => void): () => void {
    this.emitter.on(`user:${userId}`, listener)
    return () => this.emitter.off(`user:${userId}`, listener)
  }
}
```

### SSE controller

```ts
app.get('/api/events/me', requireAuth, async (c) => {
  const user = c.get('user')
  return streamSSE(c, async (stream) => {
    const unsubscribe = events.subscribeUser(user.id, (event) => {
      stream.writeSSE({ data: JSON.stringify(event), event: event.type })
    })

    // Heartbeat every 20s
    const heartbeat = setInterval(() => {
      stream.write(': heartbeat\n\n').catch(() => clearInterval(heartbeat))
    }, 20_000)

    stream.onAbort(() => {
      unsubscribe()
      clearInterval(heartbeat)
    })

    // Keep connection open
    await new Promise(() => {})
  })
})
```

### Broadcasting on role change

```ts
// In roles.service.ts
async updateRolePermissions(roleId: string, permissionIds: Permission[], actor: AuthUser) {
  await this.repo.replacePermissions(roleId, permissionIds)
  const affectedUserIds = await this.repo.getUsersWithRole(roleId)

  // Invalidate caches
  for (const userId of affectedUserIds) {
    permissionCache.invalidate(userId)
  }

  // Push SSE
  for (const userId of affectedUserIds) {
    events.publishToUser(userId, {
      type: 'permissions_changed',
      payload: { addedCount: ..., removedCount: ... },
    })
  }

  await audit.log({ entity_type: 'role', entity_id: roleId, action: 'update', actor_user_id: actor.id, ... })
}
```

### Broadcasting on user deactivation

```ts
async deactivate(userId: string, actor: AuthUser) {
  await this.repo.setActive(userId, false)
  await this.repo.revokeAllSessions(userId)
  events.publishToUser(userId, { type: 'session_invalidated', payload: { reason: 'deactivated' } })
  await audit.log({ ... })
}
```

---

## Client-side SSE consumption

```ts
// hooks/useAuthEventStream.ts
export function useAuthEventStream() {
  const queryClient = useQueryClient()
  const router = useRouter()

  useEffect(() => {
    let es: EventSource | null = null
    let backoff = 1000

    const connect = () => {
      es = new EventSource('/api/events/me', { withCredentials: true })

      es.onopen = () => { backoff = 1000 }

      es.onmessage = (msg) => {
        const event = JSON.parse(msg.data) as AppEvent
        handleEvent(event)
      }

      es.onerror = () => {
        es?.close()
        setTimeout(connect, backoff)
        backoff = Math.min(backoff * 2, 30_000)
      }
    }

    const handleEvent = (event: AppEvent) => {
      switch (event.type) {
        case 'session_invalidated':
          window.location.href = '/login?reason=' + event.payload.reason
          break
        case 'permissions_changed':
          queryClient.invalidateQueries({ queryKey: ['me'] })
          toast.info(t('permissions.updated'))
          break
        case 'claim_updated':
        case 'claim_created':
        case 'claim_deleted':
          // Signal only — refetch via query keys; never patch cache from payload.
          queryClient.invalidateQueries({ queryKey: claimKeys.lists(event.payload.kind) })
          if (event.payload.id) {
            queryClient.invalidateQueries({ queryKey: claimKeys.detail(event.payload.kind, event.payload.id) })
          }
          break
        case 'attachment_added':
        case 'observation_added':
          queryClient.invalidateQueries({
            queryKey: claimKeys.detail(event.payload.claimKind, event.payload.claimId),
          })
          break
        // ...
      }
    }

    connect()
    return () => es?.close()
  }, [queryClient, router])
}
```

Mounted once in `_app.tsx` layout, active for the lifetime of the session.

---

## TanStack Query configuration

```ts
// lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,    // 5 min (matches Better-Auth cookie cache)
      gcTime: 30 * 60_000,       // 30 min
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (isHttpError(error) && error.status === 401) return false
        if (isHttpError(error) && error.status === 403) return false
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})

// Global error handling
queryClient.getMutationCache().subscribe((event) => {
  if (event.type === 'updated' && event.mutation.state.status === 'error') {
    const error = event.mutation.state.error
    if (isHttpError(error) && error.status === 401) {
      window.location.href = '/login'
    } else if (isHttpError(error) && error.status === 403) {
      toast.error(t('errors.forbidden'))
    } else {
      toast.error(t('errors.unknown'))
    }
  }
})
```

---

## Rate limiting (Better-Auth + Cloudflare + per-route)

Three layers:

1. **Cloudflare WAF rules** (edge, cheapest) — coarse rate limits per IP per subdomain
2. **Better-Auth built-in** — login, password reset, registration endpoints
3. **Hono middleware** — custom per-route limits for expensive operations (exports, bulk ops)

Example Hono middleware:

```ts
// core/middleware/rate-limit.ts
import { rateLimiter } from 'hono-rate-limiter'

export const exportLimiter = rateLimiter({
  windowMs: 60_000,
  limit: 3,  // 3 exports per minute per user
  keyGenerator: (c) => c.get('user')?.id ?? c.req.header('cf-connecting-ip') ?? 'anon',
  standardHeaders: 'draft-7',
})

// applied on the route
app.post('/api/excel/export', requirePermission('export.workbook_full'), exportLimiter, handler)
```

---

## CSRF protection

- Better-Auth's built-in Origin/Referer validation + Fetch Metadata checks
- `trustedOrigins` configured with all three frontend subdomains (staging and prod)
- `SameSite=Lax` cookie default prevents standard CSRF
- All mutations use JSON with `Content-Type: application/json` (not simple requests)
- We never use HTML `<form>` tags that POST cross-origin

---

## Summary of security layers

```
┌─ Cloudflare ────────────────────────────────────┐
│  WAF, DDoS, geo-block, rate-limit               │
├─ Railway ───────────────────────────────────────┤
│  TLS termination, private network               │
├─ Frontend proxy ────────────────────────────────┤
│  Forward to internal API; SameSite=Lax cookies  │
├─ Hono middleware ───────────────────────────────┤
│  CORS, CSRF, auth, permission, rate-limit       │
├─ Service ───────────────────────────────────────┤
│  Business rules (e.g. own-customer filtering)   │
├─ Repository ────────────────────────────────────┤
│  Query with actor context (defense in depth)    │
├─ Postgres ──────────────────────────────────────┤
│  Single db user, connection via private network │
└─────────────────────────────────────────────────┘
```

Any single layer failing does not compromise the others.
