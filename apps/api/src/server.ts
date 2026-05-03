import { createAuth, createPermissionResolver } from '@mr/auth'
import { serve } from '@hono/node-server'
import { createLogger } from '@mr/logger'

import { createApp } from './app.js'
import { parseEnv } from './config/env.js'
import { createDb } from './infrastructure/db.js'
import { AuditService } from './modules/audit/index.js'

const env = parseEnv()
const logger = createLogger('api')

const { db, pool } = createDb(env)
const auth = createAuth(db, { trustedOrigins: env.PUBLIC_ORIGINS })
const permissionResolver = createPermissionResolver(db)
const auditService = new AuditService(db)

const app = createApp({ logger, env, auth, permissionResolver, auditService })

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
    hostname: env.HOST,
  },
  (info) => {
    logger.info({ port: info.port, address: info.address }, 'Server listening')
  },
)

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down')
  server.close(async () => {
    logger.info('HTTP server closed')
    await pool.end()
    logger.info('DB pool closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
