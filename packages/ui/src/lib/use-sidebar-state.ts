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

export interface SidebarStateOptions {
  /**
   * What the SERVER already rendered with. Supply it and the hook trusts it: no storage is read
   * after mount, so the rail cannot slide shut once the page is on screen.
   *
   * ⚠ This is the whole point of the option. Reading the remembered value in an effect is
   * "SSR-safe" only in the sense that it does not crash — the server still draws the rail open
   * for somebody who keeps it closed, and the browser then drags 180px of page sideways. Measured
   * on internal-web, 2026-08-24: CLS **2.31** across thirty shifts on one load.
   */
  initialCollapsed?: boolean
  /** Where the new value goes. Supply it together with `initialCollapsed`, from the same place —
   *  a store only the browser can read cannot be what the server rendered from. */
  persist?: (collapsed: boolean) => void
}

/**
 * Collapsible-sidebar state shared by the internal and admin shells: a desktop
 * icon-rail plus a mobile off-canvas drawer. The single header toggle collapses
 * the rail on desktop and opens/closes the drawer on mobile; growing back to
 * desktop closes a lingering drawer.
 *
 * With no options it keeps the original behaviour — remembered in localStorage under
 * `storageKey`, read after mount — which is what admin-web still uses.
 */
export function useSidebarState(
  storageKey: string,
  { initialCollapsed, persist }: SidebarStateOptions = {},
): SidebarState {
  const isDesktop = useIsWide(DESKTOP_MIN_WIDTH_PX)
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const serverKnows = initialCollapsed !== undefined

  useEffect(() => {
    if (serverKnows) {
      return
    }
    setCollapsed(localStorage.getItem(storageKey) === '1')
  }, [storageKey, serverKnows])

  useEffect(() => {
    if (isDesktop) {
      setMobileOpen(false)
    }
  }, [isDesktop])

  const onToggle = useCallback(() => {
    if (isDesktop) {
      setCollapsed((prev) => {
        const next = !prev
        if (persist === undefined) {
          localStorage.setItem(storageKey, next ? '1' : '0')
        } else {
          persist(next)
        }
        return next
      })
    } else {
      setMobileOpen((prev) => !prev)
    }
  }, [isDesktop, storageKey, persist])

  const onCloseMobile = useCallback(() => setMobileOpen(false), [])

  return { collapsed, mobileOpen, onToggle, onCloseMobile }
}
