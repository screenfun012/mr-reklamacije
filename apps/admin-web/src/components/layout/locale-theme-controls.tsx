import { m, type Locale } from '@mr/i18n'
import { cn, useLocale } from '@mr/ui'
import type { ReactElement } from 'react'

import { useTheme } from '~/lib/theme'

function LocaleSegment({
  value,
  current,
  onSelect,
}: {
  value: Locale
  current: Locale
  onSelect: (locale: Locale) => void
}): ReactElement {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(value)
      }}
      className={cn(
        'cursor-pointer px-[11px] py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-transparent text-muted-foreground hover:text-foreground',
      )}
    >
      {value}
    </button>
  )
}

/**
 * EN/SR segmented control + dark/light toggle, in the top bar.
 *
 * Both used to live inside the user menu, two clicks deep, while internal-web has shown them in the
 * bar all along — one of the differences that made the two apps read as separate products. This is
 * a deliberate per-app COPY of internal-web's control, not an import: apps never import UI from
 * each other, and the two cannot share one anyway since each reads its own `~/lib/theme`.
 *
 * The toggle writes an explicit theme; a stored 'system' preference stays honoured until it is
 * clicked.
 */
export function LocaleThemeControls(): ReactElement {
  const { locale, setLocale } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = (): void => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex overflow-hidden rounded-lg border border-mr-border-strong">
        <LocaleSegment value="en" current={locale} onSelect={setLocale} />
        <LocaleSegment value="sr" current={locale} onSelect={setLocale} />
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className="cursor-pointer rounded-lg border border-mr-border-strong bg-transparent px-[13px] py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-muted-foreground hover:text-foreground"
      >
        {resolvedTheme === 'dark' ? m.theme_light() : m.theme_dark()}
      </button>
    </div>
  )
}
