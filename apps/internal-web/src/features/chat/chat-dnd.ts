import { useStoredFlag } from '~/lib/use-stored-flag'

/**
 * „Ne uznemiravaj". Per BROWSER, not per account — that is what the switch's own tooltip promises
 * ("Važi samo u ovom pregledaču"), and it is the honest scope for a thing you flip while you are
 * head-down in one job.
 *
 * ⚠ It silences the POPUP and nothing else: the bell still fills, the counts still count. A
 * mention you never see is worse than one that waited (handoff §7).
 */
export const CHAT_DND_STORAGE_KEY = 'mrr:internal:chat:dnd'

export function useChatDnd(): [boolean, (next: boolean) => void] {
  return useStoredFlag(CHAT_DND_STORAGE_KEY, false)
}
