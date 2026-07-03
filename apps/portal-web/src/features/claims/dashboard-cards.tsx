import { m } from '@mr/i18n'
import {
  ClaimOutcome,
  ClientClaimPhase,
  PORTAL_SUPPORT_EMAIL,
  PORTAL_SUPPORT_PHONE,
  type ClientPortalActivityItem,
  type ClientPortalStats,
} from '@mr/shared'
import { cn } from '@mr/ui'

import { MaskedIcon } from '~/components/masked-icon'
import { useLocale } from '~/lib/locale'
import { formatPortalClaimId, formatPortalTimeAgo } from '~/lib/portal-format'

import { PHASE_COLOR } from './claim-status-presentation'

function StatCard({
  label,
  value,
  accent,
  delay,
}: {
  label: string
  value: number
  accent: 'info' | 'warn' | 'ok'
  delay: string
}) {
  return (
    <div
      className={cn(
        'mrp-fade-up relative w-[152px] overflow-hidden rounded-xl bg-mrp-surface px-[18px] py-4 sm:w-[170px]',
        accent === 'warn' ? 'border border-[rgba(245,166,35,0.35)]' : 'border border-mrp-border',
      )}
      style={{ animationDelay: delay }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mrp-text2">
          {label}
        </span>
        {accent === 'warn' ? (
          <MaskedIcon name="cog" spinning className="size-[15px] text-mrp-warn" />
        ) : (
          <span
            className="size-2 rounded-full"
            style={{ background: accent === 'info' ? PHASE_COLOR.info : PHASE_COLOR.ok }}
          />
        )}
      </div>
      <div className="font-mono text-[30px] font-bold leading-none tabular-nums">{value}</div>
    </div>
  )
}

/** The three dashboard stat cards (counts across ALL claims, not the page). */
export function DashboardStats({ stats }: { stats: ClientPortalStats }) {
  return (
    <div className="flex flex-wrap gap-3.5">
      <StatCard
        label={m.portal_stats_received()}
        value={stats.received}
        accent="info"
        delay="0.1s"
      />
      <StatCard
        label={m.portal_stats_in_progress()}
        value={stats.inProgress}
        accent="warn"
        delay="0.18s"
      />
      <StatCard label={m.portal_stats_outcome()} value={stats.resolved} accent="ok" delay="0.26s" />
    </div>
  )
}

function activityDotColor(item: ClientPortalActivityItem): string {
  if (item.event === ClientClaimPhase.Received) return PHASE_COLOR.info
  if (item.event === ClientClaimPhase.InProgress) return PHASE_COLOR.warn
  return item.outcome === ClaimOutcome.Rejected ? PHASE_COLOR.bad : PHASE_COLOR.ok
}

function activityLabel(item: ClientPortalActivityItem): string {
  if (item.event === ClientClaimPhase.Received) return m.portal_activity_received()
  if (item.event === ClientClaimPhase.InProgress) return m.portal_activity_in_progress()
  const outcome =
    item.outcome === ClaimOutcome.Rejected ? m.portal_status_declined() : m.portal_status_accepted()
  return m.portal_activity_outcome({ outcome })
}

/** "Recent activity" rail card — dot feed built from the safe server projection. */
export function ActivityCard({
  activity,
  now,
}: {
  activity: ClientPortalActivityItem[]
  now: Date
}) {
  const { locale } = useLocale()

  return (
    <div
      className="mrp-fade-up rounded-[14px] border border-mrp-border bg-mrp-surface p-[22px]"
      style={{ animationDelay: '0.25s' }}
    >
      <h3 className="mb-4 text-[15px] font-bold">{m.portal_activity_heading()}</h3>
      {activity.length === 0 ? (
        <p className="text-[13.5px] text-mrp-text2">{m.portal_activity_empty()}</p>
      ) : (
        <div className="flex flex-col">
          {activity.map((item, index) => (
            <div
              key={`${item.claimId}-${item.event}-${item.occurredAt}`}
              className={cn(
                'flex gap-3 py-[11px]',
                index < activity.length - 1 && 'border-b border-mrp-border',
              )}
            >
              <span
                className="mt-1.5 size-2 flex-none rounded-full"
                style={{ background: activityDotColor(item) }}
              />
              <div className="min-w-0">
                <div className="text-[13.5px] leading-[1.45]">
                  <span className="font-mono text-[12.5px] font-bold">
                    {formatPortalClaimId(item.mrNumber, item.claimNumber)}
                  </span>{' '}
                  {activityLabel(item)}
                </div>
                <div className="mt-[3px] font-mono text-[10.5px] text-mrp-text2">
                  {formatPortalTimeAgo(item.occurredAt, locale, now)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Technician / support contact card. The dashboard shows the generic MR support
 * contact; the claim detail passes the assigned technician's name. Email/phone
 * are always the static support contacts — personal employee emails don't
 * exist in the system (deliberate decision, 2026-07-03).
 */
export function SupportCard({
  title,
  name,
  initials,
  email = PORTAL_SUPPORT_EMAIL,
  withTopHairline = false,
  delay = '0.35s',
}: {
  title: string
  name: string
  initials: string
  email?: string
  withTopHairline?: boolean
  delay?: string
}) {
  return (
    <div
      className="mrp-fade-up relative overflow-hidden rounded-[14px] border border-mrp-border bg-mrp-surface p-[22px]"
      style={{ animationDelay: delay }}
    >
      {withTopHairline && (
        <span className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#ed1c24,transparent_70%)]" />
      )}
      <h3 className="mb-4 text-[15px] font-bold">{title}</h3>
      <div className="mb-3.5 flex items-center gap-[13px]">
        <span className="grid size-11 flex-none place-items-center rounded-full border border-mrp-border2 bg-mrp-raised text-[15px] font-bold text-mrp-redh">
          {initials}
        </span>
        <div>
          <div className="text-[15px] font-bold">{name}</div>
          <div className="text-xs text-mrp-text2">{m.portal_support_role()}</div>
        </div>
      </div>
      <a
        href={`mailto:${email}`}
        className="mb-[5px] block text-[13.5px] text-mrp-redh hover:underline"
      >
        {email}
      </a>
      <div className="font-mono text-[13px]">{PORTAL_SUPPORT_PHONE}</div>
      <div className="mt-[9px] font-mono text-[10.5px] tracking-[0.06em] text-mrp-text2">
        {m.portal_support_hours()}
      </div>
    </div>
  )
}
