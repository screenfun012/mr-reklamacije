import { serve } from '@hono/node-server'
import { createLogger } from '@mr/logger'

import { createApp } from './app.js'
import { parseEnv } from './config/env.js'
import { createContainer } from './core/container.js'

const env = parseEnv()
const logger = createLogger('api')
const container = createContainer(env, logger)

const app = createApp(container)

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
    await container.pool.end()
    logger.info('DB pool closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
