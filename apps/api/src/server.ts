import { serve } from '@hono/node-server'
import { createLogger } from '@mr/logger'

import { createApp } from './app.js'
import { parseEnv } from './config/env.js'

const env = parseEnv()
const logger = createLogger('api')

const app = createApp({ logger, env })

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
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
