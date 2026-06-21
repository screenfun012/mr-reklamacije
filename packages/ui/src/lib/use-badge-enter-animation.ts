import { useEffect, useRef, useState } from 'react'

/** Runs fade-in-scale once when `value` changes (not on initial mount). */
export function useBadgeEnterAnimation(value: string): boolean {
  const previousRef = useRef<string | null>(null)
  const [isEntering, setIsEntering] = useState(false)

  useEffect(() => {
    const previous = previousRef.current
    previousRef.current = value

    if (previous === null || previous === value) {
      return
    }

    setIsEntering(true)
    const timer = window.setTimeout(() => setIsEntering(false), 250)
    return () => window.clearTimeout(timer)
  }, [value])

  return isEntering
}
