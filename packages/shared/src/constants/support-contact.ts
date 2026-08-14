import { ClaimKind } from '../enums.js'

// Client-facing MR support inbox, by claim kind: domestic claims go to the
// Serbian reklamacije inbox, foreign (emotive) partners to the English claims
// inbox. Shown in the portal contact card.
export const SUPPORT_EMAIL_BY_KIND: Record<ClaimKind, string> = {
  [ClaimKind.Emotive]: 'claims@mrgroup.rs',
  [ClaimKind.Domace]: 'reklamacije@mrgroup.rs',
}

// Portal clients are EMOTIVE partners, so the pre-login screens (login,
// pending approval) show the English claims inbox as the general contact.
export const PORTAL_SUPPORT_EMAIL = SUPPORT_EMAIL_BY_KIND[ClaimKind.Emotive]

// Static workshop contact shown in the portal technician/support card. The
// phone deliberately does NOT come from the internal app (per design handoff).
export const PORTAL_SUPPORT_PHONE = '062/1144888'
