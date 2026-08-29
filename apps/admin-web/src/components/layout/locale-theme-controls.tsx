import { m, type Locale } from '@mr/i18n'
import { cn, useLocale } from '@mr/ui'
import { Moon, Sun } from 'lucide-react'
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
        'cursor-pointer px-3 py-2 font-mono text-[10.5px] font-semibold uppercase transition-colors',
        active
          ? 'bg-mr-brand text-white'
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

  const nextThemeLabel = resolvedTheme === 'dark' ? m.theme_light() : m.theme_dark()

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex overflow-hidden rounded-lg border border-mr-border-strong">
        <LocaleSegment value="en" current={locale} onSelect={setLocale} />
        <LocaleSegment value="sr" current={locale} onSelect={setLocale} />
      </div>
      {/* A glyph, not the word: the word is the only element in this bar whose width changes with
          the language AND with the current theme, and it was the widest thing in the corner. */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={nextThemeLabel}
        title={nextThemeLabel}
        className="grid size-[34px] cursor-pointer place-items-center rounded-lg border border-mr-border-strong bg-adm-inbg text-muted-foreground transition-colors hover:text-foreground"
      >
        {/* Both glyphs stay mounted and cross-fade with a quarter turn — a hard swap blinks. */}
        <span className="relative grid size-4 place-items-center">
          <Sun
            aria-hidden="true"
            className={cn(
              'adm-theme-glyph col-start-1 row-start-1 size-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none',
              resolvedTheme === 'dark' ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0',
            )}
          />
          <Moon
            aria-hidden="true"
            className={cn(
              'adm-theme-glyph col-start-1 row-start-1 size-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none',
              resolvedTheme === 'dark' ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100',
            )}
          />
        </span>
      </button>
    </div>
  )
}
