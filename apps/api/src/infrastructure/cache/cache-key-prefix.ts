import { createHash } from 'node:crypto'

import type { Env } from '../../config/env.js'

function baseCachePrefix(nodeEnv: Env['NODE_ENV']): string {
  switch (nodeEnv) {
    case 'production':
      return 'prod'
    case 'staging':
      return 'staging'
    case 'development':
      return 'dev'
    case 'test':
      return 'test'
    default: {
      const exhaustive: never = nodeEnv
      return exhaustive
    }
  }
}

/**
 * Namespaces every Redis key by environment (docs/24) so ONE shared Redis can serve
 * prod/dev/staging without collisions — each env's keys carry its own prefix, so dropping
 * `dev.*` never touches prod.
 *
 * Production additionally carries a tiny 4-char guard derived from `BETTER_AUTH_SECRET` (which
 * is unique per environment): `prod.{guard}.`. Nothing outside real prod can read or clobber
 * prod's cache even if it mistakenly uses the `prod` prefix, because it lacks the secret — a
 * small, memory-cheap protection factor for production. (Naming cannot stop a deliberate
 * FLUSHALL; that is guarded operationally — see the settings.json flush hook + memory rule.)
 */
export function resolveCacheKeyPrefix(env: Env): string {
  const base = baseCachePrefix(env.NODE_ENV)
  if (env.NODE_ENV !== 'production') return base
  const guard = createHash('sha256').update(env.BETTER_AUTH_SECRET).digest('hex').slice(0, 4)
  return `${base}.${guard}`
}
