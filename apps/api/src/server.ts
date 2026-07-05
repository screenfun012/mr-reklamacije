import { serve } from '@hono/node-server'
import { createLogger } from '@mr/logger'

import { createApp } from './app.js'
import { parseEnv } from './config/env.js'
import { createContainer } from './core/container.js'

const LISTEN_RETRY_MS = 250
const LISTEN_RETRY_MAX = 40
const SHUTDOWN_FORCE_MS = 3000

const env = parseEnv()
const logger = createLogger('api')
const container = createContainer(env, logger)

if (env.API_REPLICA_COUNT > 1) {
  // The in-process event bus cannot propagate SSE across instances — a claim
  // mutated on one replica never reaches a client connected to another.
  logger.warn(
    { replicaCount: env.API_REPLICA_COUNT },
    'Multiple API replicas with an in-process event bus: realtime (SSE) will NOT propagate across instances. Swap InProcessEventBus for a distributed bus (Postgres LISTEN/NOTIFY or Redis) before scaling.',
  )
}

const app = createApp(container)

let isShuttingDown = false
let httpServer: ReturnType<typeof serve> | null = null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startListening(): Promise<void> {
  for (let attempt = 0; attempt <= LISTEN_RETRY_MAX; attempt += 1) {
    if (isShuttingDown) return

    try {
      await new Promise<void>((resolve, reject) => {
        const server = serve(
          {
            fetch: app.fetch,
            port: env.PORT,
            hostname: env.HOST,
          },
          (info) => {
            logger.info({ port: info.port, address: info.address }, 'Server listening')
            resolve()
          },
        )

        httpServer = server

        server.once('error', (err: NodeJS.ErrnoException) => {
          httpServer = null
          reject(err)
        })
      })
      return
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String(err.code) : ''
      if (code === 'EADDRINUSE' && attempt < LISTEN_RETRY_MAX) {
        logger.warn({ port: env.PORT, attempt: attempt + 1 }, 'Port in use, retrying listen')
        await sleep(LISTEN_RETRY_MS)
        continue
      }
      throw err
    }
  }
}

function shutdown(signal: string): void {
  if (isShuttingDown) return
  isShuttingDown = true
  logger.info({ signal }, 'Shutting down')

  const forceTimer = setTimeout(() => {
    logger.warn('Shutdown timeout — forcing exit')
    process.exit(0)
  }, SHUTDOWN_FORCE_MS)
  forceTimer.unref()

  if (!httpServer) {
    clearTimeout(forceTimer)
    process.exit(0)
    return
  }

  httpServer.close(() => {
    clearTimeout(forceTimer)
    void container.claimReportPdfRenderer
      .dispose()
      .catch(() => {
        // Browser already gone — nothing to release.
      })
      .then(() => container.pool.end())
      .finally(() => {
        logger.info('DB pool closed')
        process.exit(0)
      })
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

await startListening()
