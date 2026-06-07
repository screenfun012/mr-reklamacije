function appendDateParam(params: URLSearchParams, key: string, value: Date | undefined): void {
  if (value === undefined) {
    return
  }
  params.set(key, value.toISOString().slice(0, 10))
}

export function serializeEmotiveClaimsListParams(
  filters: Record<string, string | number | boolean | Date | undefined>,
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) {
      continue
    }

    if (value instanceof Date) {
      appendDateParam(params, key, value)
      continue
    }

    if (typeof value === 'boolean') {
      params.set(key, value ? 'true' : 'false')
      continue
    }

    params.set(key, String(value))
  }

  return params.toString()
}

export function serializeReferenceListParams(
  filters: Record<string, string | number | boolean | undefined>,
  cursor?: string,
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) {
      continue
    }

    if (typeof value === 'boolean') {
      params.set(key, value ? 'true' : 'false')
      continue
    }

    params.set(key, String(value))
  }

  if (cursor) {
    params.set('cursor', cursor)
  }

  return params.toString()
}
