import { m } from '@mr/i18n'

/**
 * Small "Novo" marker for a claim-detail section with unseen server-side
 * content (Phase 3.1 `sectionFreshness`). Same visual language — mrp-info
 * tokens — as the list's freshness chip (`ClaimCard`).
 */
export function SectionNewBadge() {
  return (
    <span className="inline-flex flex-none items-center whitespace-nowrap rounded-full bg-mrp-info-bg px-[9px] py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-mrp-info">
      {m.portal_section_new()}
    </span>
  )
}
