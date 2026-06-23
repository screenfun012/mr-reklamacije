# Build from monorepo root: `docker compose build api`
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./turbo.json

COPY tooling ./tooling
COPY packages ./packages
COPY apps ./apps

RUN pnpm install --frozen-lockfile

# Chromium for claim report PDF export (Playwright). Disabled at runtime via CLAIM_REPORT_PDF_ENABLED=false.
RUN pnpm --filter api exec playwright install chromium --with-deps

ENV NODE_ENV=development

EXPOSE 3000

CMD ["pnpm", "--filter", "api", "run", "dev"]
