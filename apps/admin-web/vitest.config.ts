import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const i18nEntry = fileURLToPath(new URL('../../packages/i18n/src/index.ts', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@mr/i18n': i18nEntry,
      '~': new URL('./src', import.meta.url).pathname,
    },
    conditions: ['development', 'import', 'module', 'browser', 'default'],
  },
  test: {
    // Mirrors internal-web: jsdom component tests occasionally exceed the 5s
    // default on a loaded runner, and a genuinely hung test still fails.
    testTimeout: 15000,
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
  },
})
