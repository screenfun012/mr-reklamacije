import {
  ClaimKind,
  ClaimOutcome,
  type ClaimKind as ClaimKindType,
  type ClaimOutcome as ClaimOutcomeType,
} from '@mr/shared'
import { Archive, CheckCircle2, Clock, Globe, Home, XCircle, type LucideIcon } from 'lucide-react'

export const OUTCOME_ICONS: Record<ClaimOutcomeType, LucideIcon> = {
  [ClaimOutcome.Pending]: Clock,
  [ClaimOutcome.Accepted]: CheckCircle2,
  [ClaimOutcome.Rejected]: XCircle,
  [ClaimOutcome.Archived]: Archive,
}

export const KIND_ICONS: Record<ClaimKindType, LucideIcon> = {
  [ClaimKind.Domace]: Home,
  [ClaimKind.Emotive]: Globe,
}
