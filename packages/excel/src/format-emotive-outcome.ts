import type { EmotiveExportRow } from './types.js'

export function formatEmotiveOutcome(outcome: EmotiveExportRow['outcome']): string | null {
  switch (outcome) {
    case 'accepted':
      return 'PRIHVACENO'
    case 'rejected':
      return 'ODBIJENO'
    case 'pending':
    case 'archived':
      return null
    default: {
      const exhaustive: never = outcome
      return exhaustive
    }
  }
}
