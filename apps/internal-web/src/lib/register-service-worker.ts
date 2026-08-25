/**
 * Registers the worker that draws a notification when the app is not open.
 *
 * ⚠ `updateViaCache: 'none'`. A service worker is cached hard by default, and a stale one keeps
 * running the OLD notification code long after a deploy — the kind of bug where the fix is shipped
 * and nothing changes for anybody.
 *
 * ⚠ Registering is NOT asking for permission. The browser is only told the file exists; the
 * question is asked when a person presses the button, because a prompt fired on load is punished
 * with a permanent refusal that the app can never undo.
 */
let registration: Promise<ServiceWorkerRegistration> | undefined
let pushUserSync: Promise<void> = Promise.resolve()

const PUSH_PREFS_DB = 'mr-chat'
const PUSH_PREFS_STORE = 'prefs'
const ACTIVE_PUSH_USER_KEY = 'active-push-user'

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.reject(new Error('Service workers are not supported'))
  }

  if (registration !== undefined) {
    return registration
  }

  registration = navigator.serviceWorker
    // `v=2` escapes the old four-hour Cloudflare cache entry; the new no-store response stays fresh.
    .register('/sw.js?v=2', { scope: '/', updateViaCache: 'none' })
    .catch((error: unknown) => {
      registration = undefined
      throw error
    })
  return registration
}

/** Keeps queued pushes from a previous account from exposing its text on a shared browser. */
export async function syncServiceWorkerPushUser(userId: string | null): Promise<void> {
  const next = pushUserSync.then(() => syncPushUserNow(userId))
  pushUserSync = next.catch(() => undefined)
  return next
}

async function syncPushUserNow(userId: string | null): Promise<void> {
  const changed = await writeActivePushUser(userId).catch(() => false)
  if (!changed && userId !== null) return

  await registerServiceWorker()
    .then((workerRegistration) => workerRegistration.getNotifications())
    .then((notifications) => notifications.forEach((notification) => notification.close()))
    .catch(() => undefined)
}

function writeActivePushUser(userId: string | null): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(false)

  return new Promise((resolve, reject) => {
    const open = indexedDB.open(PUSH_PREFS_DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(PUSH_PREFS_STORE)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      try {
        const database = open.result
        const transaction = database.transaction(PUSH_PREFS_STORE, 'readwrite')
        const store = transaction.objectStore(PUSH_PREFS_STORE)
        const current = store.get(ACTIVE_PUSH_USER_KEY)
        let changed = false
        current.onerror = () => reject(current.error)
        current.onsuccess = () => {
          changed = current.result !== userId
          store.put(userId, ACTIVE_PUSH_USER_KEY)
        }
        transaction.oncomplete = () => {
          database.close()
          resolve(changed)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
      } catch (error) {
        open.result.close()
        reject(error)
      }
    }
  })
}
