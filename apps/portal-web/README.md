# portal-web

TanStack Start SSR frontend for MR Reklamacije — external client portal.

**Phase 0 skeleton:** centered layout, `/` + `/login` only.

## Local development

1. Ensure `apps/api` is running on port 3000.
2. Copy `.env.example` to `.env`.
3. Run `pnpm --filter portal-web dev`.
4. Open <http://localhost:3003>.

**Dev proxy:** `vite.config.ts` forwards **`/api/**`** to `apps/api` (`http://localhost:3000`) while `pnpm dev` is running. Production requires routing **`/api`** to the API at the edge (not this Vite plugin). See `docs/11-deployment.md`.

## Scripts

Same as admin-web / internal-web (`dev`, `build`, `preview`, `start`, `typecheck`, `lint`). TanStack Router generates `src/routeTree.gen.ts` on dev/build.
