import { pendingClientSubmissionsCountOptions } from '@mr/shared'
import { cn } from '@mr/ui'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'

const rootRoute = getRouteApi('__root__')

/**
 * Live count of pending submissions on the "Pristiglo" nav item. Reads the dedicated
 * pending-count endpoint (one integer, no rows/JOIN/attachment subquery) and is invalidated
 * by the `client_submission` SSE signal, so it updates as tickets arrive/are handled.
 */
export function InboxNavBadge({ className }: { className?: string }): React.ReactElement | null {
  const { authSession } = rootRoute.useRouteContext()
  const canManage = authSession?.user?.permissions.includes('client_submissions.manage') === true

  const { data } = useQuery({
    ...pendingClientSubmissionsCountOptions(),
    enabled: canManage,
  })

  const count = data?.total ?? 0
  if (count === 0) {
    return null
  }

  return (
    <span
      className={cn(
        'ml-auto inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-mri-red px-1.5 font-mono text-[10.5px] font-bold text-white',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
