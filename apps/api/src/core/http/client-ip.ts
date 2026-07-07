import { isIP } from 'node:net'
import type { Context } from 'hono'

/**
 * Client IP behind the production chain: browser → Cloudflare → web app proxy → api.
 *
 * Trust model:
 * - `cf-connecting-ip` is set (and any inbound value overwritten) by Cloudflare,
 *   so it cannot be forged as long as the web apps are reachable only through the
 *   CF-proxied domains (the default `*.up.railway.app` domains stay disabled —
 *   see docs/11).
 * - Otherwise the RIGHTMOST `x-forwarded-for` entry: appended by the
 *   infrastructure edge for the connecting peer. Leftmost entries are
 *   client-writable and must never be used for rate limiting or audit.
 * - Dev (nothing sets these headers): null.
 */
export function clientIpOf(c: Context): string | null {
  const cf = c.req.header('cf-connecting-ip')?.trim()
  if (cf !== undefined && isIP(cf) !== 0) {
    return cf
  }

  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded === undefined) {
    return null
  }
  const rightmost = forwarded.split(',').at(-1)?.trim() ?? ''
  return isIP(rightmost) === 0 ? null : rightmost
}
