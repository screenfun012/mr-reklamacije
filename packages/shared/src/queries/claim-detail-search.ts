import { z } from 'zod'

export const ClaimDetailTab = {
  Pregled: 'pregled',
  Kvarovi: 'kvarovi',
  Prilozi: 'prilozi',
  Izvestaj: 'izvestaj',
} as const

export type ClaimDetailTab = (typeof ClaimDetailTab)[keyof typeof ClaimDetailTab]

const claimDetailTabValues = [
  ClaimDetailTab.Pregled,
  ClaimDetailTab.Kvarovi,
  ClaimDetailTab.Prilozi,
  ClaimDetailTab.Izvestaj,
] as const

export const ClaimDetailSearchSchema = z.object({
  tab: z.enum(claimDetailTabValues).default(ClaimDetailTab.Pregled),
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
