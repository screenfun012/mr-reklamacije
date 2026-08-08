import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { ApiError } from '../api/api-error.js'

const DEFAULT_STALE_MS = 30_000
const MAX_QUERY_RETRIES = 3

/**
 * 404 belongs on this list for the same reason as the other three: the answer cannot change by
 * asking again. Retrying it cost four requests and **7.7 seconds of an empty screen** before a
 * not-found box appeared — measured 2026-08-08 on a serviser opening an order that is not his, which
 * is the exact case this app answers with 404 rather than 403 so as not to leak existence. A tablet
 * in front of a customer cannot spend eight seconds saying nothing.
 */
function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (
      error.status === 401 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 429
    ) {
      return false
    }
  }

  return failureCount < MAX_QUERY_RETRIES
}

/**
 * The one QueryClient configuration all three apps share: 30s staleTime, no
 * retry on 401/403/429, and a global 401 hook (apps pass their sign-out
 * handling — this package must not depend on @mr/auth).
 */
export function createAppQueryClient(onUnauthorized: () => void): QueryClient {
  const onQueryOrMutationError = (error: unknown): void => {
    if (error instanceof ApiError && error.status === 401) {
      onUnauthorized()
    }
  }

  return new QueryClient({
    queryCache: new QueryCache({
      onError: onQueryOrMutationError,
    }),
    mutationCache: new MutationCache({
      onError: onQueryOrMutationError,
    }),
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_MS,
        retry: shouldRetryQuery,
      },
    },
  })
}
