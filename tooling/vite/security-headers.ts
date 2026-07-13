/**
 * HTTP security response headers for the TanStack Start / Nitro web apps.
 *
 * Applied in PRODUCTION only (see each app's `vite.config.ts` — gated on
 * `command === 'build'`) via Nitro `routeRules`, so dev HMR / websockets / the
 * Vite client are never affected. All three SPAs share this helper (DRY); the
 * only per-app difference is `frame-src` (the portal PDF viewer frames a
 * `blob:` URL).
 *
 * ── Loosened directives (documented for a future nonce-based tightening) ──
 * - `script-src 'unsafe-inline'`: TanStack Start injects inline hydration
 *   scripts and the portal ships two inline bootstrap scripts (locale + theme,
 *   via `dangerouslySetInnerHTML`). A nonce-based CSP is the follow-up.
 * - `style-src 'unsafe-inline'`: Tailwind v4 + SSR inject inline `<style>` and
 *   components use inline `style={{ ... }}` attributes.
 * - `img-src data: blob:`: CSS-mask glyphs / inline SVG use `data:`; client-side
 *   image previews (tiptap upload, compress-image) use `blob:` object URLs.
 * - `frame-src blob:` (portal only): the in-app PDF report viewer streams the
 *   PDF into a Blob and frames the resulting `blob:` URL.
 */

/** Directives identical across every SPA. */
const SHARED_CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
] as const

/** Non-CSP headers shared by document AND proxied `/api/**` responses. */
const BASE_SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
}

export interface SpaSecurityHeaderOptions {
  /** Extra `frame-src` sources beyond `'self'` (portal needs `'blob:'`). */
  readonly frameSrc?: readonly string[]
}

/** Security headers for the SPA's HTML document (and static asset) responses. */
export function buildSpaDocumentHeaders(
  options: SpaSecurityHeaderOptions = {},
): Record<string, string> {
  const frameSrc = ['frame-src', "'self'", ...(options.frameSrc ?? [])].join(' ')
  return {
    ...BASE_SECURITY_HEADERS,
    'content-security-policy': [...SHARED_CSP_DIRECTIVES, frameSrc].join('; '),
    'x-frame-options': 'DENY',
  }
}

/**
 * Headers for proxied `/api/**` responses. The API already sets its own secure
 * headers; these MIRROR them so the web layer's `/**` rule can never frame-block
 * an API response — internal-web embeds inline PDF attachments from the API in a
 * same-origin `<iframe>`, which requires `frame-ancestors 'self'` (never `'none'`).
 */
const SPA_API_PROXY_HEADERS: Readonly<Record<string, string>> = {
  ...BASE_SECURITY_HEADERS,
  'content-security-policy':
    "default-src 'none'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
  'x-frame-options': 'SAMEORIGIN',
}

/** Nitro `routeRules` map: strict headers on documents, API-safe headers on `/api/**`. */
export function spaSecurityRouteRules(
  options: SpaSecurityHeaderOptions = {},
): Record<string, { headers: Record<string, string> }> {
  return {
    '/**': { headers: buildSpaDocumentHeaders(options) },
    '/api/**': { headers: { ...SPA_API_PROXY_HEADERS } },
  }
}
