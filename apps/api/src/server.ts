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

if (env.API_REPLICA_COUNT > 1 && env.REDIS_URL === undefined) {
  // SSE propagates across replicas via Postgres LISTEN/NOTIFY, and the rate
  // limiter + login-lockout share state via Redis when REDIS_URL is set. Without
  // Redis both fall back to per-process in-memory state, so the effective
  // per-IP/user limit and the lockout fragment (multiply) by replica count.
  logger.warn(
    { replicaCount: env.API_REPLICA_COUNT },
    'Multiple API replicas without REDIS_URL: the rate limiter and login-lockout fall back to per-process in-memory state and fragment across replicas. Set REDIS_URL (private redis.railway.internal) to share them. The permission-cache 5-min staleness is separate and already accepted (docs/20).',
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
    void container.pdfRenderer
      .dispose()
      .catch(() => {
        // Browser already gone — nothing to release.
      })
      .then(() => container.eventBus.dispose?.())
      .then(() => container.cache.dispose())
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
