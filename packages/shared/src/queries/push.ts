import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'

import { fetchNoContent } from '../api/fetch-no-content.js'
import { fetchParsed } from '../api/fetch-json.js'
import { pushSubscriptionModeValues, type PushSubscriptionMode } from '../constants/chat.js'

export const pushKeys = {
  all: ['push'] as const,
  publicKey: () => [...pushKeys.all, 'public-key'] as const,
  devices: (userId: string) => [...pushKeys.all, 'devices', userId] as const,
  /** Not the server's answer but this BROWSER's — whether it holds a subscription of its own. */
  thisBrowser: (userId: string) => [...pushKeys.all, 'this-browser', userId] as const,
}

/**
 * The key the browser needs to subscribe — and the honest answer to "is push available here at
 * all". Null when the server has no VAPID keys, and then the screen must not offer a button:
 * `PushManager.subscribe` cannot be called without one.
 */
const PushPublicKeySchema = z.object({ publicKey: z.string().nullable() })

export function pushPublicKeyOptions() {
  return queryOptions({
    queryKey: pushKeys.publicKey(),
    queryFn: () => fetchParsed('/api/push/public-key', PushPublicKeySchema),
    // It changes only when somebody edits the server's environment and redeploys.
    staleTime: Infinity,
  })
}

const PushDeviceSchema = z.object({
  id: z.string().uuid(),
  userAgent: z.string().nullable(),
  mode: z.enum(pushSubscriptionModeValues),
  createdAt: z.string(),
  isCurrent: z.boolean(),
})

export type PushDevice = z.infer<typeof PushDeviceSchema>

const PushDevicesResponseSchema = z.object({
  items: z.array(PushDeviceSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

export function pushDevicesOptions(userId: string) {
  return queryOptions({
    queryKey: pushKeys.devices(userId),
    queryFn: () => fetchParsed('/api/push/devices', PushDevicesResponseSchema),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

export function subscribeToPush(subscription: {
  endpoint: string
  keys: { p256dh: string; auth: string }
}): Promise<void> {
  return fetchNoContent('/api/push/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription),
  })
}

/** Per PERSON, not per device (Nikola, 2026-08-23) — the server moves every row they have. */
export function setPushMode(mode: PushSubscriptionMode): Promise<void> {
  return fetchNoContent('/api/push/mode', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
}

export function removePushDevice(id: string): Promise<void> {
  return fetchNoContent(`/api/push/devices/${id}`, { method: 'DELETE' })
}
