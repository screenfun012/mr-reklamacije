import { handleUnauthorizedSession } from '@mr/auth/route-guards'
import { ApiError } from '@mr/shared'
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { authClient } from './auth-client'

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

function onQueryOrMutationError(error: unknown): void {
  if (error instanceof ApiError && error.status === 401) {
    handleUnauthorizedSession(() => authClient.signOut())
  }
}

export function createQueryClient(): QueryClient {
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
