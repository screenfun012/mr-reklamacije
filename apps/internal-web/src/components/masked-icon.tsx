import { cn } from '@mr/ui'
import type { CSSProperties } from 'react'

/**
 * Design-handoff glyphs (cog/check) ship as black-on-transparent PNGs and are
 * ALWAYS rendered via CSS mask so they can be tinted with `currentColor` — the
 * signature rotating cog inherits whatever text color its parent sets.
 * Same pattern as the portal's masked-icon (TODO: hoist with the --mri/--mrp
 * tokens u zajednički paket kad admin dođe na red).
 */
const ICON_SRC = {
  cog: '/internal/icon-cog.png',
  check: '/internal/icon-check.png',
} as const

type MaskedIconName = keyof typeof ICON_SRC

function maskStyle(name: MaskedIconName): CSSProperties {
  const mask = `url('${ICON_SRC[name]}') center / contain no-repeat`
  return { WebkitMask: mask, mask, background: 'currentColor' }
}

export function MaskedIcon({
  name,
  className,
  spinning = false,
}: {
  name: MaskedIconName
  className?: string
  spinning?: boolean
}) {
  if (spinning) {
    return (
      <span className={cn('mri-spin-cog grid flex-none place-items-center', className)}>
        <span aria-hidden className="block size-full" style={maskStyle(name)} />
      </span>
    )
  }
  return <span aria-hidden className={cn('block flex-none', className)} style={maskStyle(name)} />
}

/** Wordmark logo, mask-tinted with the theme's logo color (white / brand red). */
export function InternalLogo({ className }: { className?: string }) {
  const mask = "url('/internal/logo-white.png') left center / contain no-repeat"
  return (
    <span
      role="img"
      aria-label="MR Engines"
      className={cn('block bg-mri-logoc', className)}
      style={{ WebkitMask: mask, mask }}
    />
  )
}
