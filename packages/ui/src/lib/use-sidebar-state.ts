import { useCallback, useEffect, useState } from 'react'

const DESKTOP_MIN_WIDTH_PX = 1024

function useIsWide(minWidthPx: number): boolean {
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${minWidthPx}px)`)
    setWide(mql.matches)
    const onChange = (event: MediaQueryListEvent): void => setWide(event.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [minWidthPx])

  return wide
}

export interface SidebarState {
  /** Desktop (≥1024px) icon-rail collapse — persisted. Ignored on mobile. */
  collapsed: boolean
  /** Mobile (<1024px) off-canvas drawer open/closed. */
  mobileOpen: boolean
  /** Header toggle: collapses the rail on desktop, opens the drawer on mobile. */
  onToggle: () => void
  onCloseMobile: () => void
}

/**
 * Collapsible-sidebar state shared by the internal and admin shells: a desktop
 * icon-rail (collapsed, persisted in localStorage under `storageKey`) plus a
 * mobile off-canvas drawer. The single header toggle collapses the rail on
 * desktop and opens/closes the drawer on mobile; growing back to desktop closes
 * a lingering drawer. SSR-safe: `matchMedia`/`localStorage` are only touched in
 * effects, so the first render is deterministic (expanded, drawer closed).
 */
export function useSidebarState(storageKey: string): SidebarState {
  const isDesktop = useIsWide(DESKTOP_MIN_WIDTH_PX)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem(storageKey) === '1')
  }, [storageKey])

  useEffect(() => {
    if (isDesktop) {
      setMobileOpen(false)
    }
  }, [isDesktop])

  const onToggle = useCallback(() => {
    if (isDesktop) {
      setCollapsed((prev) => {
        const next = !prev
        localStorage.setItem(storageKey, next ? '1' : '0')
        return next
      })
    } else {
      setMobileOpen((prev) => !prev)
    }
  }, [isDesktop, storageKey])

  const onCloseMobile = useCallback(() => setMobileOpen(false), [])

  return { collapsed, mobileOpen, onToggle, onCloseMobile }
}
