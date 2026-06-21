import { config } from 'dotenv'
import { resolve } from 'node:path'

import { assertIntegrationDatabase, getIntegrationDatabaseUrl } from './integration-db.js'

/** Monorepo root from `packages/db/src/test-helpers`. */
export function repoRootFromDbPackage(testHelpersDir: string): string {
  return resolve(testHelpersDir, '../../../..')
}

export function loadRepoEnv(repoRoot: string): void {
  config({ path: resolve(repoRoot, '.env.example') })
  config({ path: resolve(repoRoot, '.env') })
  config({ path: resolve(repoRoot, 'apps/api/.env') })
}

export function integrationVitestPaths(repoRoot: string): {
  globalSetup: string
  setupFiles: string[]
} {
  const helpers = resolve(repoRoot, 'packages/db/src/test-helpers')
  return {
    globalSetup: resolve(helpers, 'integration-global-setup.ts'),
    setupFiles: [resolve(helpers, 'integration-setup-env.ts')],
  }
}

/** Pin DATABASE_URL to the integration test DB before Vitest loads test files. */
export function applyIntegrationDatabaseEnv(): string {
  const url = getIntegrationDatabaseUrl()
  assertIntegrationDatabase(url)
  process.env['DATABASE_URL'] = url
  process.env['TEST_DATABASE_URL'] = url
  return url
}
