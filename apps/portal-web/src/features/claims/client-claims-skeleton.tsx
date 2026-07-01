import { Skeleton } from '@mr/ui'

const PLACEHOLDER_CARDS = Array.from({ length: 6 }, (_, index) => index)

export function ClientClaimsSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fill,minmax(328px,1fr))]">
        {PLACEHOLDER_CARDS.map((index) => (
          <div
            key={index}
            className="flex flex-col gap-[18px] rounded-md border border-border bg-card p-[22px]"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-20 rounded-[3px]" />
            </div>
            <Skeleton className="h-6 w-40" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
