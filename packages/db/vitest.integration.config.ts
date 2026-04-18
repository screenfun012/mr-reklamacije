import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(packageDir, '..', '..')
// Load tracked defaults first, then optional local overrides (see docs/DEV_SETUP.md)
config({ path: resolve(repoRoot, '.env.example') })
config({ path: resolve(repoRoot, '.env') })

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/__tests__/integration/**/*.test.ts'],
    passWithNoTests: false,
  },
})
