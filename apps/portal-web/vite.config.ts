import { createProxyMiddleware } from 'http-proxy-middleware'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import type { PluginOption } from 'vite'
import { defineConfig } from 'vite'

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

export default defineConfig({
  server: {
    port: 3003,
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
})
