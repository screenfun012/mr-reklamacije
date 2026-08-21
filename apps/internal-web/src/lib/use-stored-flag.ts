import { useCallback, useEffect, useState } from 'react'

/** A boolean remembered in localStorage, read after mount so SSR and the first paint agree. */
export function useStoredFlag(
  storageKey: string,
  defaultValue: boolean,
): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) {
      setValue(stored === '1')
    }
  }, [storageKey])

  const update = useCallback(
    (next: boolean) => {
      localStorage.setItem(storageKey, next ? '1' : '0')
      setValue(next)
    },
    [storageKey],
  )

  return [value, update]
}
