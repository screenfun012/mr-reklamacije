import { z } from 'zod'

export const ClaimDetailTab = {
  Pregled: 'pregled',
  Nalazi: 'nalazi',
  Prilozi: 'prilozi',
  Izvestaj: 'izvestaj',
  Razgovor: 'razgovor',
} as const

export type ClaimDetailTab = (typeof ClaimDetailTab)[keyof typeof ClaimDetailTab]

const claimDetailTabValues = [
  ClaimDetailTab.Pregled,
  ClaimDetailTab.Nalazi,
  ClaimDetailTab.Prilozi,
  ClaimDetailTab.Izvestaj,
  ClaimDetailTab.Razgovor,
] as const

export const ClaimDetailSearchSchema = z.object({
  /**
   * A tab slug this build does not know lands on Pregled instead of taking the route down.
   * The set is not frozen — `kvarovi` was a tab until the faults moved into the claim's own
   * edit (2026-08-21 handoff §5) — and a link in someone's history or a pinned browser tab
   * must still open the claim.
   */
  tab: z.enum(claimDetailTabValues).default(ClaimDetailTab.Pregled).catch(ClaimDetailTab.Pregled),
  /**
   * Which category's list this claim was opened from, when it was. Not a filter — it is what
   * lets the sidebar keep the right entry lit and the back link return where you came from.
   */
  categoryCode: z.string().trim().min(1).optional(),
})

export type ClaimDetailSearch = z.infer<typeof ClaimDetailSearchSchema>

export const CLAIM_DETAIL_DEFAULT_SEARCH: ClaimDetailSearch = {
  tab: ClaimDetailTab.Pregled,
}
