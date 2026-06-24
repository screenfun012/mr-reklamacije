import { createProxyMiddleware } from 'http-proxy-middleware'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import type { PluginOption } from 'vite'
import { defineConfig, mergeConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const i18nEntry = fileURLToPath(new URL('../../packages/i18n/src/index.ts', import.meta.url))

/** Workspace packages resolve from src in dev (package.json "development" export). */
const mrWebDevSettings = {
  server: {
    watch: {
      // Do not ignore paraglide — compile must invalidate @mr/i18n in the running dev server.
      ignored: ['**/dist/**', '**/.turbo/**'],
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
      '@mr/i18n': i18nEntry,
      tslib: 'tslib/tslib.es6.mjs',
    },
    conditions: ['development', 'import', 'module', 'browser', 'default'],
  },
} as const

/**
 * Dev-only: forward `/api/**` to apps/api before TanStack Start SSR.
 * See apps/admin-web/vite.config.ts — same pattern; port differs per app.
 */
function apiProxyPlugin(): PluginOption {
  return {
    name: 'mr-api-proxy',
    enforce: 'pre',
    configureServer(server) {
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
      port: 3002,
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
