# @mr/auth

Shared **Better Auth** configuration and (later) RBAC helpers for MR Reklamacije.

## Role

- Wraps **Better Auth** (sessions, credentials, 2FA plugin) with project-specific options.
- **RBAC** (permission resolver, session helpers) is planned for phase 6.3.

## Config layout

| File | Phase | Purpose |
|------|--------|---------|
| `better-auth.generate.config.ts` | **6.1a** | CLI only — `pnpm auth:generate`. No `@mr/db`, no `DATABASE_URL`. Used with `--adapter drizzle`. |
| `better-auth.config.ts` (runtime) | **6.1b** | Real pool + Drizzle from `@mr/db`; used by `apps/api` later. |

Keep model names, `additionalFields`, and plugins aligned between generate and runtime configs (or deduplicate in a follow-up).

## Generating Drizzle schema

When Better Auth options or plugins that affect tables change, from `packages/auth` run:

`pnpm auth:generate`

Output is written to `packages/db/src/schema/better-auth.ts`. Then use Drizzle migrations in `@mr/db` (phase 6.2).
