# admin-web

TanStack Start SSR frontend for the MR Reklamacije admin panel.

**Phase 0 status:** 9.1a skeleton.

## Local development

1. Ensure the backend (`apps/api`) is running on port 3000.
2. Copy `.env.example` to `.env`.
3. Run `pnpm --filter admin-web dev`.
4. Open <http://localhost:3001>.

## Stack

- TanStack Start 1.167.59 + Router 1.169.1
- Vite 8 + `@vitejs/plugin-react` 6
- Nitro 3 (beta) for SSR server bundling
- React 19.2.5
- Tailwind v4 via `@mr/tailwind-preset`
- `@mr/ui`, `@mr/i18n`, `@mr/auth` (workspace deps)

## Phase 0 roadmap

- **9.1a** — Skeleton (this commit): root layout, single home route,
  Tailwind + fonts wired, @mr/ui smoke test
- **9.1b** — Auth flow: login route, Better-Auth client, API proxy
- **9.1c** — AppShell: sidebar, language switcher, nested routes

## Scripts

- `pnpm dev` — Vite dev server with HMR on port 3001
- `pnpm build` — Production build via Nitro (outputs to `.output/`)
- `pnpm start` — Serve the Nitro production bundle
- `pnpm typecheck` — `tsc --noEmit`
  (requires `src/routeTree.gen.ts`; run `pnpm dev` once first)
- `pnpm lint` — ESLint
