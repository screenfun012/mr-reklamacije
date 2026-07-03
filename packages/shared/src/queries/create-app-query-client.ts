import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { ApiError } from '../api/api-error.js'

const DEFAULT_STALE_MS = 30_000
const MAX_QUERY_RETRIES = 3

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403 || error.status === 429) {
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
