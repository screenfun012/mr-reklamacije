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
})

export type ClaimDetailSearch = z.infer<typeof ClaimDetailSearchSchema>

export const CLAIM_DETAIL_DEFAULT_SEARCH: ClaimDetailSearch = {
  tab: ClaimDetailTab.Pregled,
}
