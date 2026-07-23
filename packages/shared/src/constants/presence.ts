/**
 * How often a viewer re-announces presence. The server drops a viewer after
 * ~2.5 missed beats (PRESENCE_STALE_MS), so this stays comfortably under that.
 */
export const PRESENCE_HEARTBEAT_MS = 15_000

/** A viewer silent longer than this is treated as gone (closed tab, lost network). */
export const PRESENCE_STALE_MS = 40_000
