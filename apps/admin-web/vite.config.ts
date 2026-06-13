import { createProxyMiddleware } from 'http-proxy-middleware'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import type { PluginOption } from 'vite'
import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

/** Workspace packages resolve from src in dev (package.json "development" export). */
const mrWebDevSettings = {
  server: {
    watch: {
      ignored: ['**/dist/**', '**/.turbo/**', '**/packages/i18n/src/paraglide/**'],
    },
    fs: {
      allow: [repoRoot],
    },
  },
  optimizeDeps: {
    exclude: ['@mr/ui', '@mr/auth', '@mr/i18n', '@mr/shared'],
  },
  ssr: {
    noExternal: ['@mr/ui', '@mr/auth', '@mr/i18n', '@mr/shared'],
  },
  resolve: {
    // Nitro/rolldown SSR: tslib CJS via __toESM yields undefined .default → prod 500.
    alias: {
      tslib: 'tslib/tslib.es6.mjs',
    },
  },
} as const

/**
 * Dev-only: forward `/api/**` to apps/api before TanStack Start SSR.
 * Vite `server.proxy` is skipped by Start (TanStack intercepts first; #2399).
 * `http-proxy-middleware` preserves multiple `Set-Cookie` lines (2FA flows).
 * All browser calls to same-origin `/api/*` (auth + business) use this path.
 *
 * Production: reverse proxy / edge routes `/api` to the API service (see README).
 */
function apiProxyPlugin(): PluginOption {
  return {
    name: 'mr-api-proxy',
    enforce: 'pre',
    configureServer(server) {
      // Mount without path prefix — use pathFilter only. A connect mount like
      // `.use('/api', ...)` strips the prefix so upstream would see wrong paths.
      server.middlewares.use(
        createProxyMiddleware({
          pathFilter: '/api/**',
          target: 'http://localhost:3000',
          changeOrigin: true,
        }),
      )
    },
  }
}

export default mergeConfig(
  mrWebDevSettings,
  defineConfig({
    server: {
      port: 3001,
      strictPort: true,
    },
    resolve: {
      alias: {
        '~': new URL('./src', import.meta.url).pathname,
      },
    },
    plugins: [
      apiProxyPlugin(),
      tailwindcss(),
      tanstackStart({ srcDirectory: 'src' }),
      viteReact(),
      nitro(),
    ],
  }),
)
