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
const ACTIVE_PUSH_USER_KEY = 'active-push-user'

/**
 * Is „ne uznemiravaj" on, on THIS device?
 *
 * The app keeps DND in `localStorage`, which a worker cannot see, so it mirrors the same flag into
 * IndexedDB — the one store both sides can reach. ⚠ Any failure here means "not on": a phone that
 * buzzes when it should not is a nuisance, but a phone that stays silent when somebody is being
 * called is a message lost.
 */
async function dndIsOn() {
  return (await readPreference(DND_KEY)) === true
}

async function activePushUserId() {
  const value = await readPreference(ACTIVE_PUSH_USER_KEY)
  return typeof value === 'string' ? value : null
}

async function readPreference(key) {
  try {
    const value = await new Promise((resolve, reject) => {
      const open = globalThis.indexedDB.open(DB_NAME, 1)
      open.onupgradeneeded = () => open.result.createObjectStore(STORE)
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const db = open.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.close()
          resolve(undefined)
          return
        }
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          db.close()
          resolve(request.result)
        }
      }
    })
    return value
  } catch {
    return undefined
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
  try {
    const windows = await globalThis.clients.matchAll({ type: 'window', includeUncontrolled: true })
    return windows.some(
      (client) =>
        client.visibilityState === 'visible' &&
        client.focused === true &&
        client.url.includes(`razgovor=${conversationId}`),
    )
  } catch {
    // A failed visibility check must fall back to an audible notification, never swallow the push.
    return false
  }
}

globalThis.addEventListener('install', (event) => {
  event.waitUntil(globalThis.skipWaiting())
})

globalThis.addEventListener('activate', (event) => {
  event.waitUntil(globalThis.clients.claim())
})

globalThis.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = {}
      try {
        payload = event.data?.json() ?? {}
      } catch {
        // A malformed payload is still a received Web Push event. WebKit requires it to be
        // user-visible, so continue with the generic application notification below.
      }

      const recipientId =
        typeof payload?.recipientId === 'string' && payload.recipientId !== ''
          ? payload.recipientId
          : undefined
      const chatPayload =
        typeof payload?.conversationId === 'string' && payload.conversationId !== ''
      // Trust only an explicit recipient that matches the active account. Payloads queued by the
      // previous release have no recipient id; a generic one-hour transition is preferable to
      // showing the previous account's chat text, even when the payload itself is malformed.
      const wrongAccount = recipientId === undefined || (await activePushUserId()) !== recipientId
      const conversationId = !wrongAccount && chatPayload ? payload.conversationId : undefined
      const silent =
        wrongAccount ||
        (conversationId !== undefined &&
          ((await dndIsOn()) || (await roomIsOnScreen(conversationId))))

      await globalThis.registration.showNotification(
        !wrongAccount && typeof payload?.title === 'string' && payload.title !== ''
          ? payload.title
          : 'MR Interna',
        {
          body: !wrongAccount && typeof payload?.body === 'string' ? payload.body : '',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          // Keep room messages together, while malformed events still receive a visible fallback.
          ...(conversationId === undefined
            ? {}
            : { tag: conversationId, data: { conversationId } }),
          // The operating system may suppress the sound for a visible room or DND, but WebKit
          // still receives a shown notification rather than a silently swallowed push event.
          silent,
          renotify: conversationId !== undefined && !silent,
        },
      )
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
