import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

import {
  applyIntegrationDatabaseEnv,
  integrationVitestPaths,
  loadRepoEnv,
  repoRootFromDbPackage,
} from '../../packages/db/src/test-helpers/integration-vitest-env.js'

const packageDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = repoRootFromDbPackage(resolve(packageDir, '../../packages/db/src/test-helpers'))

loadRepoEnv(repoRoot)
applyIntegrationDatabaseEnv()

const { globalSetup, setupFiles } = integrationVitestPaths(repoRoot)

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    fileParallelism: false,
    globalSetup: [globalSetup],
    setupFiles,
    include: [
      'src/**/__tests__/**/*.integration.test.ts',
      'src/**/__tests__/**/*.http.integration.test.ts',
      'src/**/__tests__/**/*.http.test.ts',
    ],
    passWithNoTests: false,
    testTimeout: 30_000,
  },
})
