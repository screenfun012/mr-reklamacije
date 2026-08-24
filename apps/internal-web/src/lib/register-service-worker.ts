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
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
    // A worker that will not register means no push on this device — and nothing else. There is
    // no screen to tell about it and nothing the person could do, so it stays quiet.
  })
}
