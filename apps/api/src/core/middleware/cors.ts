/**
 * CORS placeholder for Phase 0.
 *
 * Per docs/12-roadmap.md: CORS is OFF for MVP because all three
 * frontends (admin-web, internal-web, portal-web) proxy /api/*
 * through Next.js middleware — browser sees same-origin requests,
 * no preflight needed.
 *
 * TODO Phase 1+: Enable via hono/cors middleware when we need
 * direct cross-origin calls (e.g., mobile app, external integrations,
 * webhooks). Read allowed origins from env.PUBLIC_ORIGINS (already
 * parsed as string[] in src/config/env.ts).
 *
 * When enabling, reference: https://hono.dev/docs/middleware/builtin/cors
 */

export {}
