const WELCOME_STORAGE_KEY = 'mrr:portal:welcomed'

/**
 * Whether this browser has already seen the first-entry welcome. Reads fail
 * gracefully: SSR, private mode, or cleared storage all report "not welcomed"
 * so the welcome simply shows again — never a crash.
 */
export function hasSeenWelcome(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  try {
    return window.localStorage.getItem(WELCOME_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Mark the welcome as seen. Storage failures (private mode, quota) are ignored. */
export function markWelcomeSeen(): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(WELCOME_STORAGE_KEY, '1')
  } catch {
    // Best-effort — the flow continues even if persistence fails.
  }
}
