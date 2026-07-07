# Build from monorepo root (Railway api service / `docker compose build api`).
# Production image by default; docker-compose's prod-like profile overrides CMD back to dev.
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Dependency layer keyed on the lockfile only — source changes don't re-download packages.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY package.json ./
COPY turbo.json ./turbo.json

COPY tooling ./tooling
COPY packages ./packages
COPY apps ./apps
# One-off ops scripts (create-admin bootstrap) — the runbook runs them on this service.
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile --prefer-offline

# Chromium for claim report PDF export (Playwright). Disabled at runtime via CLAIM_REPORT_PDF_ENABLED=false.
RUN pnpm --filter api exec playwright install chromium --with-deps

# Builds the api and its workspace dependencies (turbo `^build`).
RUN pnpm exec turbo run build --filter=api

ENV NODE_ENV=production

EXPOSE 3000

CMD ["pnpm", "--filter", "api", "start"]
