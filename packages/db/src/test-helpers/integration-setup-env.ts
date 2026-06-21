import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertIntegrationDatabase, getIntegrationDatabaseUrl } from './integration-db.js'
import { loadRepoEnv, repoRootFromDbPackage } from './integration-vitest-env.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

loadRepoEnv(repoRootFromDbPackage(__dirname))

const url = getIntegrationDatabaseUrl()
assertIntegrationDatabase(url)
process.env['DATABASE_URL'] = url
process.env['TEST_DATABASE_URL'] = url
