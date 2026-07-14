# 01 — Architecture

## High-level diagram

```
                            ┌─────────────────────┐
                            │     Cloudflare      │
                            │  (WAF, DDoS, geo)   │
                            └──────────┬──────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
┌────────▼────────┐          ┌─────────▼────────┐         ┌──────────▼────────┐
│  admin-web      │          │  internal-web    │         │  portal-web       │
│  (TanStack St.) │          │  (TanStack St.)  │         │  (TanStack St.)   │
│                 │          │                  │         │                   │
│ admin.mrengines │          │ interno.mrengin. │         │ reklamacije.mr…   │
└────────┬────────┘          └─────────┬────────┘         └──────────┬────────┘
         │                             │                             │
         └─────────────── private network ───────────────────────────┘
                                       │
                             ┌─────────▼─────────┐
                             │      api          │
                             │      (Hono)       │
                             └─────────┬─────────┘
                                       │
                      ┌────────────────┼────────────────┐
                      │                │                │
             ┌────────▼──────┐  ┌──────▼──────┐  ┌──────▼────────┐
             │  postgres     │  │ volumes     │  │ OpenAI API    │
             │  (Railway)    │  │ (uploads)   │  │ (translation) │
             └───────────────┘  └─────────────┘  └───────────────┘
```

## Services (5 Railway services)

| Service | Tech | Purpose | Domain |
|---|---|---|---|
| `api` | Hono + Node.js | REST API, auth, business logic, SSE | `api.mrengines.rs` |
| `admin-web` | TanStack Start | Admin toolbox | `admin.mrengines.rs` |
| `internal-web` | TanStack Start | Employees + viewers | `interno.mrengines.rs` |
| `portal-web` | TanStack Start | Client read-only portal | `reklamacije.mrengines.rs` |
| `postgres` | Railway managed | Single PostgreSQL instance | private only |

## Private networking

All frontend services proxy `/api/*` requests through their own Node.js server
to the API service via Railway's internal IPv6 network
(`api.railway.internal`). This means:

- Browser never talks to API directly — API appears same-origin as frontend
- Cookies stay host-only, `SameSite=Lax`, maximum security
- No CORS headaches in the browser
- Zero bandwidth cost for internal traffic
- Lower latency (inside Railway datacenter)

### Proxy implementation (TanStack Start)

Each frontend app has a catch-all server route that forwards `/api/*` to the API service:

```ts
// src/routes/api/$.tsx (in each of admin-web, internal-web, portal-web)
import { createAPIFileRoute } from '@tanstack/react-start/api'

export const APIRoute = createAPIFileRoute('/api/$')({
  GET: forwardToApi,
  POST: forwardToApi,
  PUT: forwardToApi,
  PATCH: forwardToApi,
  DELETE: forwardToApi,
})

async function forwardToApi({ request, params }) {
  const apiUrl = process.env.API_INTERNAL_URL  // api.railway.internal
  const targetUrl = `${apiUrl}/${params._splat}`
  // forward headers (including cookie, origin, CF-Connecting-IP) and body
  return fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
}
```

## Domain and subdomain strategy

### Why three subdomains instead of routes?

1. **Physical code isolation.** Admin JavaScript never ships to clients. Client bundle cannot contain admin code even in principle.
2. **Independent rollback.** If admin-web deployment breaks, internal-web and portal-web keep running. Blast radius is minimized.
3. **Per-subdomain security policies.** Admin can require 2FA + IP whitelist + geo-blocking; portal stays accessible to international clients.
4. **Per-subdomain rate limits.** Admin login endpoint gets 5 req/min, portal login gets 20 req/min.

### Why NOT cross-subdomain cookies

Better-Auth supports `crossSubDomainCookies` but their own documentation
warns against it when subdomains have different trust levels. Using a shared
`.mrengines.rs` cookie would mean: XSS on the client portal (most exposed
surface) could exfiltrate an admin session. This is unacceptable.

**Decision:** every subdomain has its own host-only cookie. A user who is
both admin and client (unlikely but possible) must log in twice.

### Cookie attributes

```ts
// Better-Auth config
advanced: {
  useSecureCookies: true,
  crossSubDomainCookies: { enabled: false },  // explicit opt-out
  defaultCookieAttributes: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',  // we never do cross-site requests thanks to proxy pattern
    partitioned: false,
  },
  cookiePrefix: 'mrr',  // short, anonymous prefix
}
```

## Isolation and blast radius

| Incident | Impacted | Safe |
|---|---|---|
| XSS on portal | That client's session | All other clients, admin, internal, API, DB |
| Compromised client account | Only their claims (enforced by RBAC) | Everything else |
| Compromised employee account | Operator permissions (no delete, no user mgmt) | Admin panel, settings, user list, audit |
| Portal frontend bug | Portal UI | All other subdomains |
| Internal frontend bug | Internal UI | Admin UI, portal UI |
| Admin frontend bug | Admin UI only | Everything keeps running for users who are logged in elsewhere |
| API bug | All frontends get errors on affected routes | Static frontend content still serves |
| Bad deployment | That single service | Other services; one-click rollback |

## Cloudflare layer

All four public domains are proxied through Cloudflare (free plan).

### Rules applied

- **DDoS protection** — automatic, all subdomains
- **WAF managed rules** — OWASP top 10, enabled on all subdomains
- **Bot fight mode** — enabled, challenges suspicious bots
- **SSL/TLS mode** — Full (strict); Cloudflare ↔ Railway uses Railway's cert
- **Always use HTTPS** — enabled
- **Automatic HTTPS rewrites** — enabled

### Per-subdomain rules

#### `admin.mrengines.rs` (strictest)

- **IP allow list:** only IPs from [office + Nikola's home] (admin-configurable)
- **Geo-blocking:** only Serbia (RS) allowed as fallback if IP list is temporarily disabled
- **Rate limit:** 30 req/min per IP (admin users don't hit this in normal use)
- **Rate limit on `/api/auth/*`:** 5 req/min per IP
- **Challenge:** Managed Challenge for any request from outside known IPs

#### `interno.mrengines.rs`

- **Geo-blocking:** Serbia + any EU country (in case someone travels)
- **Rate limit:** 60 req/min per IP
- **Rate limit on `/api/auth/*`:** 10 req/min per IP

#### `reklamacije.mrengines.rs` (most permissive)

- **No geo-blocking** (international clients)
- **Rate limit:** 120 req/min per IP
- **Rate limit on `/api/auth/*`:** 10 req/min per IP
- **Rate limit on `/api/auth/register`:** 3 req/hour per IP (prevent spam registration)

#### `api.mrengines.rs`

- Not reachable directly from browser in normal operation (proxied through frontends)
- Publicly exposed only for mobile apps or future integrations; rate limits match corresponding subdomain

### Real IP forwarding

Railway sees Cloudflare IPs unless we read `CF-Connecting-IP` header.
Better-Auth is configured to use **only** this header for IP tracking and rate
limiting (`packages/auth/src/options.ts`):

```ts
advanced: {
  ipAddress: {
    ipAddressHeaders: ['cf-connecting-ip'],
  }
}
```

`x-forwarded-for` is deliberately **not** listed: Better-Auth resolves the IP
from the leftmost value of the first matching header, and the leftmost
`x-forwarded-for` entry is client-forgeable (Cloudflare appends the real IP to
the right). `cf-connecting-ip` is a single, CF-controlled value, so leftmost is
safe. This mirrors the hardened `clientIpOf` (`apps/api/src/core/http/client-ip.ts`)
used by every other audit / rate-limit path.

## Environments

Railway environments we will use:

- **`production`** — deploys from `main` branch, connected to production domains
- **`staging`** — deploys from `develop` branch, connected to `staging-*` subdomains
- **PR environments** — auto-created per pull request for isolated review

Staging uses a separate PostgreSQL database seeded with anonymized production data (or fresh seed).

## Secret management

All secrets live in Railway environment variables, never in git.
Required variables per service documented in `docs/11-deployment.md`.

## Backup strategy

- **Database:** Railway automated daily backups (7-day retention) + nightly logical
  dump pushed to Synology NAS via SSH cron job.
- **Volumes (uploads):** nightly rsync from Railway volume mount to Synology.
- **Retention on Synology:** 30 daily snapshots + 12 monthly snapshots.

Restore procedure documented in `docs/11-deployment.md`.

## Observability

- **Logs:** Railway built-in, streamed to console (structured JSON via pino)
- **Errors:** captured in audit log for business-critical actions, logged for
  technical errors. No external error tracking (Sentry, etc.) in MVP — add later
  if needed.
- **Metrics:** Railway dashboard (CPU, memory, request count)
- **Uptime monitoring:** Cloudflare health checks + UptimeRobot free tier on public subdomains

## Scalability ceiling

This architecture comfortably handles:
- 50 concurrent internal users
- 500 concurrent client users
- 100k claims in database
- 1M file attachments
- 10k requests/minute

If we ever exceed these (we won't in the next 3 years), we vertically scale
Railway resources. No horizontal scaling or microservices needed.
