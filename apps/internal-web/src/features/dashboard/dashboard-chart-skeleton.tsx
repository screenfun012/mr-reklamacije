import { Card, CardContent, CardHeader, Skeleton } from '@mr/ui'

/**
 * Loading skeleton for the dashboard claims chart. Lives in its own
 * recharts-free module so routes can import it without pulling the
 * recharts bundle into the entry chunk.
 */
export function DashboardClaimsChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-72 w-full rounded-lg" />
      </CardContent>
    </Card>
  )
}
