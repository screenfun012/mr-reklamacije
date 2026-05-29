import { createAuth, createPermissionResolver, type Auth, type PermissionResolver } from '@mr/auth'
import { schema } from '@mr/db'
import type { Logger } from '@mr/logger'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { Pool } from 'pg'

import type { Env } from '../config/env.js'
import { createDb } from '../infrastructure/db.js'
import { AuditService } from '../modules/audit/index.js'

/**
 * Application DI container. All stateful services are constructed here once
 * per process; route modules receive slices via `createApp(container)`.
 */
export interface Container {
  env: Env
  logger: Logger
  db: NodePgDatabase<typeof schema>
  pool: Pool
  auth: Auth
  permissionResolver: PermissionResolver
  auditService: AuditService
}

export function createContainer(env: Env, logger: Logger): Container {
  const { db, pool } = createDb(env)
  const auth = createAuth(db, { trustedOrigins: env.PUBLIC_ORIGINS })
  const permissionResolver = createPermissionResolver(db)
  const auditService = new AuditService(db)

  return {
    env,
    logger,
    db,
    pool,
    auth,
    permissionResolver,
    auditService,
  }
}
