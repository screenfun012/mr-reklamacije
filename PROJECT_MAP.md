# PROJECT_MAP.md — mapa foldera

> Kratak vodič kroz repo: šta se nalazi gde. Za pravila rada, arhitekturu i konvencije
> pogledati `CLAUDE.md` (glavni izvor istine) — ovaj fajl je čisto orijentaciona mapa.

## Root

- `CLAUDE.md` — konsolidovan kontekst za rad (arhitektura, konvencije, dogovor sa Nikolom).
- `CONTRIBUTING.md` — pre-commit gate, redosled komandi.
- `README.md`, `STATUS.md` — opšti opis projekta i trenutni status.
- `docs/` — detaljna dokumentacija po temama (numerisani fajlovi `01`–`16`: arhitektura,
  data model, permisije, moduli, auth/realtime, excel flow, prevod, file storage, UI/UX,
  testiranje, deployment, roadmap, admin control plane, brand guidelines, machining/firms).
- `scripts/` — pomoćne CLI skripte za dev okruženje (`dev-all`, `dev-check`, `dev-api`,
  `create-admin-user`, audit/cleanup skripte za duplikate i "junk" fajlove) + `db-init/`.
- `design_handoff_internal_app/` — dizajn hendof materijali (assets) za internal-web.
- `docker-compose.yml` — lokalni Postgres i eventualno API kontejner za dev.
- `turbo.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` — monorepo/build orkestracija (Turborepo + pnpm workspaces).
- `.cursor/rules/*.mdc` — obavezujuća pravila (blokiraju PR-ove); `CLAUDE.md` je njihov sažetak.
- `.github/workflows/` — CI definicije.
- `.husky/` — git hookovi (pre-commit gate).
- `tooling/` — deljene tooling konfiguracije (ispod).

## `apps/` — 4 samostalne aplikacije

- **`apps/api`** — Hono + Node REST API. Jedino što dodiruje bazu. Struktura:
  - `src/core/` — DI kontejner, middleware (uklj. `require-permission`), errors, http helpers, config/env.
  - `src/modules/<name>/` — po modulu: `schema.ts`, `validators.ts`, `repository.ts`, `service.ts`,
    `controller.ts`, `routes.ts`, `__tests__/`. Moduli: `activation`, `attachments`, `audit`,
    `claim-reports`, `claim-sources`, `claims`, `customers`, `dashboard`, `departments`,
    `domace-claims`, `emotive-claims`, `employees`, `engine-manufacturers`, `engine-types`,
    `events` (SSE), `excel`, `external-parties`, `mr-registry`, `registration`, `statistics`, `users`.
  - `src/infrastructure/` — auth, email, storage implementacije.
  - `src/routes/` — agregacija ruta.
  - `scripts/` — one-off skripte koje se voze i u prod image (npr. `create-admin`, `import-legacy`, `recompress-attachments`).
- **`apps/admin-web`** — TanStack Start SPA, kontrolna tabla (korisnici, role, šifarnici, audit, podešavanja).
- **`apps/internal-web`** — TanStack Start SPA za zaposlene/viewer-e (obrada reklamacija — EMOTIVE/DOMACE).
- **`apps/portal-web`** — TanStack Start SPA za klijente (read-only pregled sopstvenih reklamacija).

Svaka od tri web app-a ima sličnu unutrašnju strukturu: `src/routes` (file-based rute),
`src/components`, `src/features` (internal-web, portal-web), `src/lib`, `src/config`, `src/styles`.
Frontendi proksiraju `/api/*` ka API-ju preko privatne mreže — nema direktnog pristupa niti CORS-a.

## `packages/` — deljeni kod (`@mr/*`)

Pravilo zavisnosti: `apps/*` sme zavisiti od `packages/*`; `packages/*` NIKAD ne zavisi od `apps/*`.

- **`packages/db`** (`@mr/db`) — Drizzle šema (`src/schema/*`), migracije (`migrations/` + `meta/_journal.json`),
  seed logika (`src/seed/`), test helperi za integracione testove. Zavisi samo od `packages/shared`.
- **`packages/shared`** (`@mr/shared`) — Zod šeme, enumi/konstante, permisije, query factory funkcije, čisti utili.
- **`packages/auth`** (`@mr/auth`) — Better-Auth konfiguracija + custom RBAC resolver, revoke-sessions logika.
- **`packages/excel`** (`@mr/excel`) — ExcelJS import/export logika.
- **`packages/i18n`** (`@mr/i18n`) — Paraglide prevodi (sr/en), `project.inlang`, skripte za proveru parity-ja.
- **`packages/ui`** (`@mr/ui`) — shadcn/ui sloj, deljene komponente, badge stilovi, tokeni.
- **`packages/logger`** (`@mr/logger`) — pino logger.
- **`packages/email`** (`@mr/email`) — slanje email-ova.

## `tooling/` — deljena tooling konfiguracija

- `tooling/eslint` — ESLint konfiguracija (`@mr/eslint-config`).
- `tooling/typescript` — deljeni `tsconfig` baze.
- `tooling/tailwind` — Tailwind v4 preset + `mr-*` brand tokeni (`index.css`).
- `tooling/vite` — deljena Vite konfiguracija (`@mr/dev-vite`).

## Napomena

Ova mapa je snapshot strukture na dan generisanja — za tačan i ažuran opis pravila,
domenskih invarijanti i trenutnog stanja rada uvek referisati `CLAUDE.md`.
