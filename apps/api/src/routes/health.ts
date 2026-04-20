import type { Context, Hono } from 'hono'

const healthHandler = (c: Context) => {
  return c.json({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
  })
}

export function registerHealthRoutes(app: Hono): void {
  app.get('/health', healthHandler)
  app.get('/api/health', healthHandler)
}
