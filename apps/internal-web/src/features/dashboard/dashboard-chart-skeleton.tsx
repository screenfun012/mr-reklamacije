import { InternalCard } from '~/components/internal-card'

/**
 * Loading skeleton for the dashboard claims chart. Lives in its own
 * recharts-free module so routes can import it without pulling the
 * recharts bundle into the entry chunk.
 */
export function DashboardClaimsChartSkeleton() {
  return (
    <InternalCard className="px-[26px] py-6">
      <div className="mb-6 h-5 w-48 animate-pulse rounded bg-mri-inbg" />
      <div className="h-[190px] w-full animate-pulse rounded-lg bg-mri-inbg" />
    </InternalCard>
  )
}
