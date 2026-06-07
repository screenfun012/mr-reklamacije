import { ApiError } from '@mr/shared'
import { QueryClient } from '@tanstack/react-query'

const DEFAULT_STALE_MS = 30_000
const MAX_QUERY_RETRIES = 3

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    return false
  }

  return failureCount < MAX_QUERY_RETRIES
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_MS,
        retry: shouldRetryQuery,
      },
    },
  })
}
