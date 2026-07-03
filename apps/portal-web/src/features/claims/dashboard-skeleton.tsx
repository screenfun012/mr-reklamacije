import { cn } from '@mr/ui'

function Block({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-[14px] bg-mrp-surface', className)} />
}

/** Loading placeholder mirroring the dashboard layout (header, greeting, cards, rail). */
export function DashboardSkeleton() {
  return (
    <div className="relative min-h-screen bg-mrp-bg">
      <div className="sticky top-0 z-20 h-16 border-b border-mrp-border bg-mrp-hdr" />
      <div className="mx-auto max-w-[1280px] px-5 pb-[72px] pt-10 sm:px-8">
        <div className="mb-[34px] flex flex-wrap items-end justify-between gap-8">
          <div className="flex flex-col gap-3">
            <Block className="h-3 w-44" />
            <Block className="h-9 w-72" />
            <Block className="h-4 w-56" />
          </div>
          <div className="flex gap-3.5">
            <Block className="h-[88px] w-[170px] rounded-xl" />
            <Block className="h-[88px] w-[170px] rounded-xl" />
            <Block className="h-[88px] w-[170px] rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Block className="h-[186px]" />
            <Block className="h-[186px]" />
            <Block className="h-[186px]" />
            <Block className="h-[186px]" />
          </div>
          <div className="flex flex-col gap-5">
            <Block className="h-[260px]" />
            <Block className="h-[190px]" />
          </div>
        </div>
      </div>
    </div>
  )
}
