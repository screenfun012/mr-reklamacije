import { clientPortalSummaryOptions } from '@mr/shared'
import { useQuery } from '@tanstack/react-query'

import { authClient } from '~/lib/auth-client'
import { formatCompanyLabel } from '~/lib/portal-format'

export interface PortalCompany {
  /** The firm alone — for avatar initials and for sentences, never carries "+N". */
  primary: string
  /** What the header prints: the firm, plus "+N" when the account holds several. */
  label: string
}

/**
 * The company a portal client belongs to, taken from their firm links rather
 * than guessed from the first claim in the list — a client with no claims yet
 * used to see their own personal name in the header (docs/16 §5.1).
 *
 * A plain `useQuery`, not a suspense one: the header must render on routes that
 * have not prefetched the summary, falling back to the account name meanwhile.
 */
export function usePortalCompany(): PortalCompany {
  const { data } = useQuery(clientPortalSummaryOptions())
  const { data: session } = authClient.useSession()

  const firmNames = (data?.firmNames ?? []).filter((name) => name.trim() !== '')
  const primary = firmNames[0] ?? session?.user.name ?? ''

  return { primary, label: formatCompanyLabel(firmNames, primary) }
}
