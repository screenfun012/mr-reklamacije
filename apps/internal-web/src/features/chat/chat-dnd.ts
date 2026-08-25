import { useStoredFlag } from '~/lib/use-stored-flag'

/**
 * „Ne uznemiravaj". Per BROWSER, not per account — that is what the switch's own tooltip promises
 * ("Važi samo u ovom pregledaču"), and it is the honest scope for a thing you flip while you are
 * head-down in one job.
 *
 * ⚠ It silences sound/vibration, not delivery or visibility: the system notification still
 * appears, the bell still fills, and the counts still count.
 */
export const CHAT_DND_STORAGE_KEY = 'mrr:internal:chat:dnd'

export function useChatDnd(): [boolean, (next: boolean) => void] {
  const [enabled, store] = useStoredFlag(CHAT_DND_STORAGE_KEY, false)

  return [
    enabled,
    (next: boolean) => {
      store(next)
      void mirrorForServiceWorker(next)
    },
  ]
}

const DB_NAME = 'mr-chat'
const STORE = 'prefs'
const DND_KEY = 'dnd'

/**
 * The same flag, written where the service worker can read it.
 *
 * ⚠ `localStorage` is defined on `Window` only — a service worker has no Web Storage at all — so
 * the switch above cannot reach the code that draws a notification while the app is closed. Without
 * this mirror, „ne uznemiravaj" would leave the phone buzzing, which is the one surface where it
 * matters most.
 *
 * IndexedDB is the store both sides can reach. Failures are swallowed: the worker reads a missing
 * value as "not on", and a phone that buzzes when it should not is a nuisance, while one that stays
 * silent when somebody is being called is a message lost.
 */
async function mirrorForServiceWorker(enabled: boolean): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    return
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1)
      open.onupgradeneeded = () => open.result.createObjectStore(STORE)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const transaction = open.result.transaction(STORE, 'readwrite')
        transaction.objectStore(STORE).put(enabled, DND_KEY)
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      }
    })
  } catch {
    // Nothing to tell anybody: the popup is already silenced, and the phone falls back to noisy.
  }
}
