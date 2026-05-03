import { createFileRoute } from '@tanstack/react-router';

// Dev proxy: catch-all server route that forwards /api/** requests to the
// separate apps/api process (Hono on :3000). TanStack Start 1.167 intercepts
// routing before Vite's server.proxy middleware, so a config-level proxy
// cannot work; Nitro routeRules also do not activate in Vite dev mode for
// this version. An explicit server file route is the pattern recommended by
// the TanStack community (discussion #2399) and works uniformly in dev and
// production.
//
// Headers are forwarded unchanged — critically the Origin header so
// Better-Auth can validate against its trustedOrigins list (PUBLIC_ORIGINS).
// The response body and Set-Cookie are streamed through unmodified so
// Better-Auth session cookies reach the browser intact.
//
// TODO(production): make the target configurable via an env variable and
// short-circuit when running behind a real reverse proxy (Cloudflare /
// Nginx) that handles /api/** routing at the edge.
const API_TARGET = 'http://localhost:3000';

type FetchInitWithDuplex = RequestInit & { duplex?: 'half' };

async function proxy({
  request,
  params,
}: {
  request: Request;
  params: { _splat?: string };
}): Promise<Response> {
  const url = new URL(request.url);
  const splat = params._splat ?? '';
  const targetUrl = `${API_TARGET}/api/${splat}${url.search}`;

  const headers = new Headers(request.headers);
  // The Host header refers to the incoming :3001 origin; letting it leak to
  // the upstream :3000 can confuse servers that do virtual-host routing.
  // Better-Auth origin validation uses the Origin header, which we preserve.
  headers.delete('host');

  const init: FetchInitWithDuplex = {
    method: request.method,
    headers,
    redirect: 'manual',
  };

  if (
    request.method !== 'GET' &&
    request.method !== 'HEAD' &&
    request.body !== null
  ) {
    init.body = request.body;
    // Node fetch requires explicit duplex when streaming a request body.
    init.duplex = 'half';
  }

  const response = await fetch(targetUrl, init);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: proxy,
      POST: proxy,
      PUT: proxy,
      PATCH: proxy,
      DELETE: proxy,
      OPTIONS: proxy,
      HEAD: proxy,
    },
  },
});
