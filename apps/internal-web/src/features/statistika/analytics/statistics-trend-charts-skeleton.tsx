import { m } from '@mr/i18n'
import { Card, CardContent, CardHeader, Skeleton } from '@mr/ui'

export function StatisticsTrendChartsSkeleton(): React.ReactElement {
  return (
    <section className="flex flex-col gap-4" aria-busy="true" aria-label={m.common_loading()}>
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full rounded-lg" />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-44" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid min-h-[8.75rem] grid-cols-3 gap-3">
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
            </div>
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-52" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid min-h-[8.75rem] grid-cols-3 gap-3">
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
            </div>
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>

      <div>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid min-h-[5.5rem] grid-cols-3 gap-3">
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
            </div>
            <Skeleton className="h-[220px] w-full rounded-lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-56" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid min-h-[5.5rem] grid-cols-3 gap-3">
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
            </div>
            <Skeleton className="h-[220px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>

      <div>
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="mx-auto h-56 w-56 rounded-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-3 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
              <Skeleton className="h-[4.5rem] rounded-lg" />
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-52" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full rounded-lg" />
        </CardContent>
      </Card>
    </section>
  )
}

export interface StatisticsTrendChartsPlaceholderProps {
  message: string
}

export function StatisticsTrendChartsPlaceholder({
  message,
}: StatisticsTrendChartsPlaceholderProps): React.ReactElement {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{message}</p>
    </section>
  )
}
