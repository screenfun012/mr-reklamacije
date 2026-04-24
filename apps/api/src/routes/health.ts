import type { Context, Env, Hono } from 'hono'

const healthHandler = (c: Context) => {
  return c.json({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  })
}

export function registerHealthRoutes<E extends Env>(app: Hono<E>): void {
  app.get('/health', healthHandler)
  app.get('/api/health', healthHandler)
}
