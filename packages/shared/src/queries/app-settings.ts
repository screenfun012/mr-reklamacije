import { queryOptions } from '@tanstack/react-query'

import { fetchJson } from '../api/fetch-json.js'
import type { AppSettingValues, AppSettingsResponse } from '../schemas/app-settings.schema.js'

export const appSettingsQueryKey = ['app-settings'] as const

/**
 * Only the OVERRIDES — a key the admin never touched is absent, and the screen reads its default
 * from `APP_SETTINGS`. That way the defaults keep following the code instead of being copied into
 * every install the first time somebody opens this page.
 */
export function appSettingsOptions() {
  return queryOptions({
    queryKey: appSettingsQueryKey,
    queryFn: () => fetchJson<AppSettingsResponse>('/api/app-settings'),
  })
}

/** A partial patch: only the keys sent are touched, and `null` puts one back on its default. */
export async function patchAppSettings(values: AppSettingValues): Promise<AppSettingsResponse> {
  return fetchJson<AppSettingsResponse>('/api/app-settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
}
