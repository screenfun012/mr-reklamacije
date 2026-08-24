/*
 * The service worker. Two jobs and no more: draw a notification when one arrives, and open the
 * right room when it is tapped.
 *
 * ⚠ Plain JavaScript in `public/`, deliberately. It is served as-is at the ROOT scope, which is
 * what lets it control the whole app — a worker built into the bundle would live under an asset
 * path and control nothing.
 *
 * ⚠ There is NO `localStorage` here. Web Storage is defined on `Window` only, so the chat's DND
 * flag cannot be read the way the rest of the app reads it — see `dndIsOn` below.
 *
 * ⚠ `globalThis` rather than `self`, and it is the same object in a worker. It is written this way
 * so the file needs no lint exception: `self`, `clients` and `indexedDB` are globals of
 * `ServiceWorkerGlobalScope` that page-code linting has never heard of, while `globalThis` is
 * standard everywhere — the file keeps every other rule instead of being excused from all of them.
 */

const DB_NAME = 'mr-chat'
const STORE = 'prefs'
const DND_KEY = 'dnd'

/**
 * Is „ne uznemiravaj" on, on THIS device?
 *
 * The app keeps DND in `localStorage`, which a worker cannot see, so it mirrors the same flag into
 * IndexedDB — the one store both sides can reach. ⚠ Any failure here means "not on": a phone that
 * buzzes when it should not is a nuisance, but a phone that stays silent when somebody is being
 * called is a message lost.
 */
async function dndIsOn() {
  try {
    const value = await new Promise((resolve, reject) => {
      const open = globalThis.indexedDB.open(DB_NAME, 1)
      open.onupgradeneeded = () => open.result.createObjectStore(STORE)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        if (!db.objectStoreNames.contains(STORE)) {
          resolve(false)
          return
        }
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(DND_KEY)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result === true)
      }
    })
    return value === true
  } catch {
    return false
  }
}

/**
 * Is the person already looking at this very room?
 *
 * Nikola's rule, 2026-08-23: do not ring for the conversation you are reading. ⚠ `visibilityState`
 * matters as much as the URL — a tab left open on that room behind another window is not somebody
 * reading it.
 */
async function roomIsOnScreen(conversationId) {
  const windows = await globalThis.clients.matchAll({ type: 'window', includeUncontrolled: true })
  return windows.some(
    (client) =>
      client.visibilityState === 'visible' && client.url.includes(`razgovor=${conversationId}`),
  )
}

globalThis.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      if (event.data === null) {
        return
      }

      let payload
      try {
        payload = event.data.json()
      } catch {
        return
      }

      const conversationId = payload.conversationId
      if (typeof conversationId !== 'string') {
        return
      }

      if ((await dndIsOn()) || (await roomIsOnScreen(conversationId))) {
        return
      }

      await globalThis.registration.showNotification(payload.title ?? '', {
        body: payload.body ?? '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        // ⚠ The room's id, so ten messages from one room replace one another instead of stacking
        // ten rows on a lock screen. Without `renotify` the replacement is silent, which is exactly
        // what is wanted for the second message in a conversation already announced.
        tag: conversationId,
        data: { conversationId },
      })
    })(),
  )
})

globalThis.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const conversationId = event.notification.data?.conversationId
  const target = typeof conversationId === 'string' ? `/razgovori?razgovor=${conversationId}` : '/'

  event.waitUntil(
    (async () => {
      const windows = await globalThis.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      // Reuse a window that is already open rather than piling up tabs — and take it to the room,
      // because tapping a notification means "show me this", not "show me the app".
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await client.navigate(target)
          }
          return
        }
      }
      await globalThis.clients.openWindow(target)
    })(),
  )
})
