import type { QueryClient } from '@tanstack/react-query'

import { statisticsKeys } from './statistics.js'

export async function invalidateStatisticsSummary(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: statisticsKeys.all })
}
