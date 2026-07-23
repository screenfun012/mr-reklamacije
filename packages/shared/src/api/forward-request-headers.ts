/**
 * Header forwarding for server-side (SSR) calls into the api.
 *
 * A browser call reaches the api through the app's `/api/**` proxy, which passes
 * the original headers along. An SSR call does NOT: route loaders and session
 * guards open a BRAND NEW connection to the api over the private network, so
 * whatever the browser sent is present only on the incoming request object and
 * has to be copied across deliberately.
 *
 * Everything that forgets to copy `cf-connecting-ip` arrives at the api with no
 * client address at all — every server-rendered page load of every user then
 * shares one rate-limit bucket, and audit rows record a null actor IP.
 */

/**
 * Client address, set (and any inbound value overwritten) by Cloudflare. Same
 * trust model the api's `clientIpOf` and the `/api/**` proxy already rely on:
 * it holds as long as the app is reachable only through the CF-proxied domains.
 *
 * `x-forwarded-for` is deliberately NOT forwarded: from inside the private
 * network its rightmost entry is this container's own peer, which would be
 * worse than sending nothing.
 */
export const CLIENT_IP_HEADER = 'cf-connecting-ip'

const FORWARDED_HEADERS = ['cookie', CLIENT_IP_HEADER] as const

/**
 * Copies the forwardable headers from `incoming` onto `target`.
 *
 * Never overwrites a header the caller set explicitly — an intentional override
 * at the call site wins over whatever the browser happened to send.
 */
export function applyForwardedRequestHeaders(target: Headers, incoming: Headers): void {
  for (const name of FORWARDED_HEADERS) {
    if (target.has(name)) {
      continue
    }
    // Truthy, not `!== null`: a blank value is worth no header at all, and real
    // callers pass request objects whose getter may hand back undefined.
    const value = incoming.get(name)
    if (value) {
      target.set(name, value)
    }
  }
}

/**
 * Applies {@link applyForwardedRequestHeaders} using the request currently being
 * server-rendered. No-op outside TanStack Start SSR (browser, tests, scripts),
 * where there is no ambient request to copy from.
 *
 * Deliberately NOT exported from the package index, and deliberately duplicated
 * (four lines) in `@mr/auth`'s server session loader: reaching for the ambient
 * request must stay INSIDE the package that needs it. Resolved across a package
 * boundary the import is external to the consumer's module graph, so a consumer
 * that mocks `@tanstack/react-start/server` silently gets the catch branch — the
 * forwarding then fails to nothing, in a test that still passes. The policy
 * (WHICH headers, never override) is what is worth sharing; this glue is not.
 */
export async function forwardSsrRequestHeaders(target: Headers): Promise<void> {
  try {
    const { getRequestHeaders } = await import('@tanstack/react-start/server')
    applyForwardedRequestHeaders(target, getRequestHeaders())
  } catch {
    // Outside TanStack Start SSR — nothing to forward.
  }
}
