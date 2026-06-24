import type { DomaceExportRow } from './types.js'

export function formatDomaceOutcome(outcome: DomaceExportRow['outcome']): string | null {
  switch (outcome) {
    case 'accepted':
      return 'PRIHVACENA'
    case 'rejected':
      return 'ODBIJENA'
    case 'pending':
    case 'archived':
      return null
    default: {
      const exhaustive: never = outcome
      return exhaustive
    }
  }
}
