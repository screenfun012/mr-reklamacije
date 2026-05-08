# internal-web

TanStack Start SSR frontend for MR Reklamacije — internal (employee) panel.

**Phase 1 skeleton:** place-holder routes until module work lands.

## Local development

1. Ensure `apps/api` is running on port 3000.
2. Copy `.env.example` to `.env`.
3. Run `pnpm --filter internal-web dev`.
4. Open <http://localhost:3002>.

## Scripts

Same as admin-web (`dev`, `build`, `preview`, `start`, `typecheck`, `lint`). TanStack Router generates `src/routeTree.gen.ts` on dev/build — run `pnpm dev` once if `typecheck` complains until the file exists.
