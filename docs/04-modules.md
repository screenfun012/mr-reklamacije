# 04 — Modules and Project Structure

## Monorepo layout

```
mr-reklamacije/
├── apps/
│   ├── api/                         # Hono API server
│   ├── admin-web/                   # TanStack Start — admin panel
│   ├── internal-web/                # TanStack Start — employees + viewers
│   └── portal-web/                  # TanStack Start — client portal
├── packages/
│   ├── db/                          # Drizzle schema, migrations, seeds, client
│   ├── shared/                      # Zod schemas, types, enums, constants, permissions
│   ├── auth/                        # Better-Auth config shared between api and web servers
│   ├── excel/                       # ExcelJS import/export logic
│   ├── i18n/                        # Paraglide translations (sr, en)
│   ├── ui/                          # Shared React components (shadcn base layer)
│   └── logger/                      # Pino logger setup
├── tooling/
│   ├── eslint/                      # @mr/eslint-config
│   ├── typescript/                  # @mr/tsconfig
│   └── tailwind/                    # @mr/tailwind-preset
├── scripts/
│   ├── etl-legacy-excel.ts          # One-time historical import
│   ├── seed-dev.ts                  # Dev data seed
│   └── backup-db.sh                 # Backup script for NAS
├── docs/                            # All docs/*.md files
├── .cursor/
│   └── rules/                       # All Cursor .mdc rule files
├── .github/
│   └── workflows/
│       ├── ci.yml                   # Lint + test on PR
│       └── deploy.yml               # Nothing; Railway handles deploys
├── docker-compose.yml               # Local Postgres for dev
├── turbo.json                       # Turborepo pipeline
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
└── README.md
```

## Monorepo tooling choice

- **Package manager:** pnpm workspaces
- **Task runner:** Turborepo (for parallel builds, test caching)
- **TypeScript:** strict mode everywhere, project references between packages

## Dependency direction rules

```
apps/*          may depend on  packages/*
packages/*      may NOT depend on apps/*
packages/db     may depend on  packages/shared
packages/auth   may depend on  packages/db, packages/shared
packages/excel  may depend on  packages/db, packages/shared
packages/ui     may depend on  packages/shared
packages/i18n   standalone (Paraglide-generated)
```

Circular dependencies between packages are forbidden. Enforced via CI check.

---

# API structure (`apps/api/`)

```
apps/api/
├── src/
│   ├── modules/                           # DOMAIN MODULES
│   │   ├── emotive-claims/
│   │   │   ├── emotive-claims.schema.ts   # re-exports from packages/db
│   │   │   ├── emotive-claims.validators.ts
│   │   │   ├── emotive-claims.repository.ts
│   │   │   ├── emotive-claims.service.ts
│   │   │   ├── emotive-claims.controller.ts
│   │   │   ├── emotive-claims.routes.ts
│   │   │   ├── emotive-claims.types.ts
│   │   │   ├── faults/
│   │   │   │   ├── faults.repository.ts
│   │   │   │   ├── faults.service.ts
│   │   │   │   └── faults.validators.ts
│   │   │   └── __tests__/
│   │   │       ├── emotive-claims.service.test.ts
│   │   │       ├── emotive-claims.controller.test.ts
│   │   │       └── emotive-claims.integration.test.ts
│   │   ├── domace-claims/                 # mirrors emotive-claims
│   │   ├── customers/
│   │   ├── employees/
│   │   ├── employee-output/
│   │   ├── departments/
│   │   ├── external-parties/
│   │   ├── engine-types/
│   │   ├── claim-sources/
│   │   ├── users/
│   │   │   ├── users.*.ts
│   │   │   └── registration/              # Client registration requests sub-module
│   │   ├── roles/
│   │   ├── permissions/                   # Permission catalog endpoint
│   │   ├── attachments/
│   │   ├── observations/
│   │   ├── excel/
│   │   │   ├── export/
│   │   │   │   ├── workbook.exporter.ts
│   │   │   │   ├── ukupno.sheet.ts
│   │   │   │   ├── year.sheet.ts
│   │   │   │   ├── emotive-stats.sheet.ts
│   │   │   │   ├── per-employee.sheet.ts
│   │   │   │   ├── domace.sheet.ts
│   │   │   │   ├── domace-2026.sheet.ts
│   │   │   │   └── shared/                # cell formatting helpers
│   │   │   ├── import/
│   │   │   │   └── legacy.importer.ts
│   │   │   ├── excel.controller.ts
│   │   │   ├── excel.routes.ts
│   │   │   └── __tests__/
│   │   ├── translation/
│   │   │   ├── translation.service.ts     # OpenAI client wrapper
│   │   │   ├── translation.cache.ts
│   │   │   ├── translation.controller.ts
│   │   │   └── translation.routes.ts
│   │   ├── stats/
│   │   │   ├── emotive-stats.service.ts
│   │   │   ├── domace-stats.service.ts
│   │   │   ├── overall-stats.service.ts
│   │   │   ├── stats.controller.ts
│   │   │   └── stats.routes.ts
│   │   ├── audit/
│   │   └── events/                        # SSE hub
│   │       ├── event-bus.ts               # In-process pub/sub
│   │       ├── sse.controller.ts
│   │       └── sse.routes.ts
│   ├── core/                              # FRAMEWORK-LEVEL
│   │   ├── container.ts                   # DI container
│   │   ├── context.ts                     # Hono Context typing
│   │   ├── errors/
│   │   │   ├── app-error.ts
│   │   │   ├── not-found.error.ts
│   │   │   ├── forbidden.error.ts
│   │   │   ├── unauthorized.error.ts
│   │   │   ├── validation.error.ts
│   │   │   └── conflict.error.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── require-permission.ts
│   │   │   ├── error-handler.ts
│   │   │   ├── cors.ts
│   │   │   ├── rate-limit.ts
│   │   │   ├── logger.middleware.ts
│   │   │   ├── validate.ts                # Zod validator middleware
│   │   │   └── audit.ts                   # Auto-audit wrapper
│   │   ├── utils/
│   │   │   ├── pagination.ts
│   │   │   ├── date-range.ts
│   │   │   └── sanitize.ts
│   │   └── config/
│   │       ├── env.ts                     # Zod-validated env
│   │       └── app.config.ts
│   ├── infrastructure/                    # EXTERNAL SERVICES
│   │   ├── storage/
│   │   │   ├── storage.interface.ts
│   │   │   ├── volume-storage.ts          # Railway volume impl
│   │   │   └── r2-storage.ts              # Stub for future R2 migration
│   │   ├── email/
│   │   │   ├── email.interface.ts
│   │   │   └── resend-email.ts
│   │   ├── openai/
│   │   │   └── openai.client.ts
│   │   └── logger/
│   │       └── pino.logger.ts
│   ├── app.ts                             # Hono app factory (testable, no listen)
│   └── server.ts                          # Entry point; calls listen()
├── tests/
│   ├── helpers/
│   │   ├── test-db.ts                     # Spin up test Postgres
│   │   ├── test-user.ts                   # Create test users with specific roles
│   │   └── fixtures.ts
│   └── integration/                       # Cross-module integration tests
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

## Module anatomy (every module follows this shape)

### `*.schema.ts`

Re-exports the Drizzle table definitions from `packages/db`. Having this local
re-export allows the module to be grep-friendly: search `emotive-claims.schema`
to find everything using it.

```ts
export { emotiveClaims, emotiveClaimFaults } from '@mr/db/schema'
```

### `*.validators.ts`

Zod schemas for inputs. Re-exports from `packages/shared` if shared with web;
defines API-specific ones here (e.g., filter query params).

```ts
import { z } from 'zod'
import { EmotiveClaimCreateInput as BaseCreate } from '@mr/shared/schemas'

export const listQuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  outcome: z.enum(['pending', 'accepted', 'rejected', 'archived']).optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const createSchema = BaseCreate  // shared with web form
```

### `*.repository.ts`

Plain data access. Only knows about Drizzle and domain entities.
**Never imports HTTP types.** Methods return plain objects, throw domain errors.

```ts
export class EmotiveClaimsRepository {
  constructor(private db: Database) {}

  async findById(id: string, opts?: { includeDeleted?: boolean }) { ... }
  async list(filters: ListFilters, user: AuthUser) { ... }
  async create(input: CreateInput, actorId: string) { ... }
  async update(id: string, patch: UpdateInput, actorId: string) { ... }
  async softDelete(id: string, actorId: string) { ... }
}
```

### `*.service.ts`

Business logic. Orchestrates repository calls, emits events, coordinates with other modules.
**Never imports HTTP types.**

```ts
export class EmotiveClaimsService {
  constructor(
    private repo: EmotiveClaimsRepository,
    private faults: FaultsService,
    private events: EventBus,
    private audit: AuditService,
  ) {}

  async create(input: CreateInput, user: AuthUser) {
    const claim = await this.repo.create(input, user.id)
    if (input.faults?.length) {
      await this.faults.attachMultiple(claim.id, input.faults, user.id)
    }
    await this.audit.log({ entity_type: 'emotive_claim', entity_id: claim.id, action: 'create', actor_user_id: user.id })
    this.events.publishClaimCreated({ kind: 'emotive', id: claim.id })
    return this.repo.findById(claim.id)  // full object with joins
  }
}
```

### `*.controller.ts`

HTTP adapters. Thin. Extract params, call service, format response.

```ts
export const emotiveClaimsController = {
  async list(c: Context) {
    const user = c.get('user')
    const filters = listQuerySchema.parse(c.req.query())
    const result = await container.emotiveClaimsService.list(filters, user)
    return c.json(result)
  },

  async create(c: Context) {
    const user = c.get('user')
    const body = await c.req.json()
    const input = createSchema.parse(body)
    const claim = await container.emotiveClaimsService.create(input, user)
    return c.json(claim, 201)
  },
  // ...
}
```

### `*.routes.ts`

Route registration with middleware.

```ts
export function registerEmotiveClaimsRoutes(app: Hono) {
  const base = new Hono()

  base.get('/', requirePermission('emotive_claims.view'), emotiveClaimsController.list)
  base.get('/:id', requirePermission('emotive_claims.view'), emotiveClaimsController.getOne)
  base.post('/', requirePermission('emotive_claims.create'), emotiveClaimsController.create)
  base.patch('/:id', requirePermission('emotive_claims.update'), emotiveClaimsController.update)
  base.delete('/:id', requirePermission('emotive_claims.delete'), emotiveClaimsController.softDelete)

  app.route('/api/emotive-claims', base)
}
```

### `*.types.ts`

Module-internal types not exposed to other modules. Cross-module types live in
`packages/shared`.

---

# Web structure (shared pattern across `admin-web/`, `internal-web/`, `portal-web/`)

Each web app has the same skeleton, but with different routes and navigation.

```
apps/admin-web/  (and internal-web, portal-web analogously)
├── src/
│   ├── routes/                            # File-based routing
│   │   ├── __root.tsx                     # Root layout
│   │   ├── index.tsx                      # Redirect or landing
│   │   ├── login.tsx
│   │   ├── logout.tsx
│   │   ├── 403.tsx                        # Forbidden page
│   │   ├── api/
│   │   │   └── $.tsx                      # Catch-all API proxy to internal api service
│   │   └── _app/                          # Auth-required route group
│   │       ├── _app.tsx                   # Layout with sidebar + header; loader checks auth
│   │       ├── dashboard.tsx
│   │       ├── ... specific to each web app
│   ├── modules/                           # UI MODULES (mirror API modules)
│   │   ├── emotive-claims/
│   │   │   ├── components/
│   │   │   │   ├── EmotiveClaimsTable.tsx
│   │   │   │   ├── EmotiveClaimForm.tsx
│   │   │   │   ├── EmotiveClaimDetail.tsx
│   │   │   │   ├── EmotiveClaimFilters.tsx
│   │   │   │   └── FaultAttributionEditor.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useEmotiveClaims.ts
│   │   │   │   ├── useCreateEmotiveClaim.ts
│   │   │   │   ├── useUpdateEmotiveClaim.ts
│   │   │   │   └── useDeleteEmotiveClaim.ts
│   │   │   ├── api/
│   │   │   │   └── emotive-claims.api.ts  # typed fetchers
│   │   │   └── types.ts
│   │   ├── domace-claims/
│   │   ├── customers/
│   │   ├── employees/
│   │   ├── stats/
│   │   ├── users/                         # admin-web only
│   │   ├── roles/                         # admin-web only
│   │   ├── settings/                      # admin-web only
│   │   ├── audit/                         # admin-web only
│   │   ├── auth/
│   │   │   ├── components/LoginForm.tsx
│   │   │   ├── hooks/useMe.ts
│   │   │   ├── hooks/usePermissions.ts    # wraps useMe + memoized Set
│   │   │   └── hooks/useAuthEventStream.ts  # SSE consumer
│   │   └── portal/                        # portal-web only
│   ├── components/                        # GENERIC UI
│   │   ├── ui/                            # shadcn primitives (Button, Input, Dialog, ...)
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── TopBar.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── data-table/                    # TanStack Table wrapper
│   │   ├── forms/
│   │   │   ├── DatePicker.tsx
│   │   │   ├── ComboboxAsync.tsx          # with "+ New" inline creation
│   │   │   ├── FileDropzone.tsx
│   │   │   └── FormField.tsx
│   │   ├── feedback/
│   │   │   ├── Toast.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── permissions/
│   │   │   ├── Can.tsx                    # <Can permission="...">children</Can>
│   │   │   └── ProtectedRoute.tsx
│   │   └── i18n/
│   │       └── LanguageSwitcher.tsx
│   ├── lib/
│   │   ├── api-client.ts                  # fetch wrapper; handles errors, auth
│   │   ├── query-client.ts                # TanStack Query setup
│   │   ├── auth-client.ts                 # Better-Auth client
│   │   ├── router.ts
│   │   └── utils.ts
│   ├── hooks/                             # global hooks (useTheme, useMediaQuery)
│   ├── styles/
│   │   └── globals.css                    # Tailwind + CSS variables
│   ├── i18n/
│   │   └── messages/                      # Paraglide generated
│   ├── client.tsx
│   ├── server.tsx
│   └── router.tsx
├── public/
├── tests/
│   ├── e2e/                               # Playwright
│   └── unit/                              # Vitest for hooks/utils
├── playwright.config.ts
├── vitest.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Route group conventions

- Routes inside `_app/*` are **auth-protected** via `_app.tsx` loader.
- Admin-specific routes also pass a `requiredPermission` prop to the layout,
  which redirects to `/403` if the user lacks it.

## Navigation wiring

`Sidebar.tsx` reads current user's permissions and renders only the navigation
items the user can access. Items are defined in a central config:

```ts
// apps/admin-web/src/config/navigation.ts
export const navItems: NavItem[] = [
  { labelKey: 'nav.dashboard', href: '/dashboard', icon: HomeIcon },
  {
    labelKey: 'nav.claims',
    icon: ClipboardListIcon,
    children: [
      { labelKey: 'nav.emotive', href: '/emotive-claims', permission: 'emotive_claims.view' },
      { labelKey: 'nav.domace', href: '/domace-claims', permission: 'domace_claims.view' },
    ],
  },
  { labelKey: 'nav.users', href: '/users', permission: 'users.view' },
  // ...
]
```

## Per-app route differences

| Route | admin-web | internal-web | portal-web |
|---|---|---|---|
| `/dashboard` | ✓ admin KPIs | ✓ operational KPIs | ✗ |
| `/emotive-claims` | ✓ full | ✓ | ✗ (portal has different view) |
| `/domace-claims` | ✓ full | ✓ | ✗ |
| `/employees` | ✓ | ✓ view + analytics | ✗ |
| `/stats/*` | ✓ all | ✓ emotive + domace | ✗ |
| `/stats/overall` | ✓ | ✗ | ✗ |
| `/users`, `/roles` | ✓ | ✗ | ✗ |
| `/settings/*` | ✓ | ✗ | ✗ |
| `/audit` | ✓ | ✗ | ✗ |
| `/import` | ✓ (one-time ETL) | ✗ | ✗ |
| `/claims` | ✗ | ✗ | ✓ (client's own) |
| `/profile` | ✓ | ✓ | ✓ |

---

## Claims module rules (locked)

These rules are mandatory for all claims-related features. Do not deviate without an explicit architectural review.

### 1. Separate detail routes per claim kind

EMOTIVE and DOMACE each have their own detail route, form, and loader
(`/reklamacije/emotive/$id`, `/reklamacije/domace/$id`). They share only small
primitives (`OutcomeBadge`, file upload, layout shell, status registry).
**Never** build a shared `ClaimDetail` component that branches on `kind`.

*Why:* the two claim types diverge in fields, validation, and workflows; a
shared detail page becomes an unmaintainable `if (kind)` tree.

### 2. Unified list, `kind` from the API only

The claims list is one table with a type column. Each row carries `kind` from the
list API (query reads both tables and stamps origin). Row links branch once to
pick the correct detail route. **`kind` is never inferred from field shape in the
UI.**

*Why:* guessing kind from nullable columns breaks when schemas evolve; the server
is the only authority on which table a row came from.

### 3. One aggregate detail fetch per claim

One detail endpoint per claim returns the full aggregate (claim + faults + customer
and worker names + attachment list + status history), assembled on the server
(JOIN in repository). Load it via the route `loader`; prefetch on hover
(`defaultPreload: 'intent'`). No per-section fetches, no request waterfalls.

*Why:* detail views need many related slices at once; a single round-trip keeps
loaders simple and avoids slow staggered rendering.

### 4. Atomic mutations for create and update

One submit → one endpoint → one transaction (claim + faults together). Client and
server share the same Zod DTO for the body. **No optimistic updates** for create
or edit — use a fast endpoint, a disabled “Saving…” button state, and redirect on
success. Optimistic updates are allowed **only** for small actions (e.g. status
change), always with rollback.

*Why:* create/update touch multiple rows; optimistic UI risks showing inconsistent
fault data until rollback, with little UX gain if the API responds quickly.

---

# `packages/` contents

## `packages/db/`

```
src/
├── schema/
│   ├── users.ts
│   ├── auth.ts              # sessions, accounts, 2fa, verification
│   ├── rbac.ts              # permissions, roles, role_permissions, user_roles
│   ├── customers.ts
│   ├── employees.ts
│   ├── departments.ts
│   ├── external-parties.ts
│   ├── engine-types.ts
│   ├── claim-sources.ts
│   ├── emotive-claims.ts
│   ├── domace-claims.ts
│   ├── attachments.ts
│   ├── observations.ts
│   ├── employee-output.ts
│   ├── audit.ts
│   ├── settings.ts
│   └── index.ts             # re-exports
├── migrations/              # drizzle-kit generated
├── seed/
│   ├── permissions.seed.ts
│   ├── roles.seed.ts
│   ├── departments.seed.ts
│   ├── claim-sources.seed.ts
│   ├── customers.seed.ts
│   ├── engine-types.seed.ts
│   ├── admin-user.seed.ts
│   └── run.ts               # orchestrator
├── client.ts
└── index.ts
```

## `packages/shared/`

```
src/
├── enums.ts                 # all text enum values as const + type
├── permissions.ts           # Permission string literal union, validation
├── schemas/                 # Zod schemas consumed by api and web
│   ├── emotive-claim.schema.ts
│   ├── domace-claim.schema.ts
│   ├── customer.schema.ts
│   ├── user.schema.ts
│   ├── role.schema.ts
│   └── ...
├── types/                   # TS types derived from Zod + DB
├── constants/
│   ├── roles.ts             # SYSTEM_ROLE_CODES
│   ├── claim-outcomes.ts
│   └── limits.ts            # MAX_FILE_SIZE_MB, etc.
├── errors/
│   └── codes.ts             # Error code constants shared with client
├── utils/                   # Pure functions
│   ├── normalize-name.ts
│   ├── format-amount.ts
│   ├── format-date.ts
│   └── parse-excel-date.ts
└── index.ts
```

## `packages/auth/`

```
src/
├── better-auth.config.ts    # consumed by both api and web (SSR)
├── permissions.ts           # Permission resolver (DB-backed)
├── session-helpers.ts       # Get session in different contexts
└── index.ts
```

## `packages/excel/`

```
src/
├── exporters/
│   ├── workbook-builder.ts  # orchestrates full export
│   ├── sheets/
│   │   ├── ukupno.ts
│   │   ├── year.ts
│   │   ├── emotive-stats.ts
│   │   ├── per-employee.ts
│   │   ├── domace.ts
│   │   └── domace-2026.ts
│   ├── styling/
│   │   ├── fonts.ts
│   │   ├── colors.ts
│   │   └── borders.ts
│   └── helpers/
├── importers/
│   ├── legacy-workbook.ts
│   ├── normalize-employee.ts
│   ├── normalize-date.ts
│   └── validators.ts
├── mappers/                 # Excel row ↔ domain object
├── constants/
│   └── column-map.ts        # hard-coded column positions (reference doc 06)
└── index.ts
```

## `packages/i18n/`

Paraglide-generated message modules + source `.json` files per locale.

```
src/
├── messages/
│   ├── sr.json
│   └── en.json
├── compiled/                # Paraglide output
└── index.ts
```

## `packages/ui/`

Only truly shared components. App-specific styling stays in each app.

```
src/
├── primitives/              # shadcn-derived
├── hooks/
└── index.ts
```

---

# Dependency injection

Simple homegrown container, no framework needed.

```ts
// apps/api/src/core/container.ts
export interface Container {
  db: Database
  logger: Logger
  events: EventBus
  audit: AuditService

  // Repositories
  emotiveClaimsRepo: EmotiveClaimsRepository
  domaceClaimsRepo: DomaceClaimsRepository
  // ... etc

  // Services
  emotiveClaimsService: EmotiveClaimsService
  domaceClaimsService: DomaceClaimsService
  // ... etc
}

export function buildContainer(deps: { db: Database }): Container {
  const logger = new PinoLogger()
  const events = new InProcessEventBus()
  const audit = new AuditService(deps.db)

  const emotiveClaimsRepo = new EmotiveClaimsRepository(deps.db)
  // ...

  const emotiveClaimsService = new EmotiveClaimsService(
    emotiveClaimsRepo, faultsService, events, audit,
  )

  return { db: deps.db, logger, events, audit, emotiveClaimsRepo, ..., emotiveClaimsService, ... }
}
```

Tests build the container with a fake `db` or stubbed services.

---

# Testing file layout convention

Tests live next to source as `__tests__/` folders. Names:

- `foo.test.ts` — unit tests for `foo.ts`
- `foo.integration.test.ts` — integration tests (hits real DB in test instance)
- `foo.e2e.ts` — end-to-end (Playwright), lives in `apps/*/tests/e2e/`

See `docs/10-testing.md` for full strategy.
