import { Skeleton } from '@mr/ui'

const SKELETON_ROW_COUNT = 6

/** Loading placeholder for the Inbox list (skeleton, not a spinner — CLAUDE.md UI rules). */
export function InboxListSkeleton(): React.ReactElement {
  return (
    <div
      className="overflow-hidden rounded-[14px] border border-mri-border bg-mri-surface"
      aria-busy="true"
    >
      <div className="border-b border-mri-border bg-mri-inbg px-5 py-4">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y divide-mri-border">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}
