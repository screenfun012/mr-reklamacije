import { m, type Locale } from '@mr/i18n'
import { cn } from '@mr/ui'
import { Moon, Sun } from 'lucide-react'

import { useLocale } from '@mr/ui'
import { useTheme } from '~/lib/theme'

function LocaleSegment({
  value,
  current,
  onSelect,
}: {
  value: Locale
  current: Locale
  onSelect: (locale: Locale) => void
}) {
  const active = value === current
  return (
    <button
      type="button"
      onClick={() => {
        onSelect(value)
      }}
      className={cn(
        'cursor-pointer px-[11px] py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors',
        active ? 'bg-mri-red text-white' : 'bg-transparent text-mri-text2 hover:text-mri-text',
      )}
    >
      {value}
    </button>
  )
}

/**
 * EN/SR segmented control + dark/light toggle (topbar and auth screens). The
 * toggle writes an explicit theme; a stored 'system' preference stays honored
 * until the user clicks it.
 *
 * `compact` drops the EN/SR pair below sm. It is for the one bar that cannot fit it: a
 * serviser has no sidebar, so the topbar also carries the user chip (shield + avatar +
 * sign-out), and on a 390px phone that row is ~75px over even after the theme glyph. The
 * language is a once-per-account choice and stays reachable on the sign-in screen and at
 * any wider width; signing out and seeing who is signed in are not.
 */
export function LocaleThemeControls({ compact = false }: { compact?: boolean } = {}) {
  const { locale, setLocale } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = (): void => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }
  const nextThemeLabel = resolvedTheme === 'dark' ? m.theme_light() : m.theme_dark()

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-mri-border2',
          compact ? 'hidden sm:flex' : 'flex',
        )}
      >
        <LocaleSegment value="en" current={locale} onSelect={setLocale} />
        <LocaleSegment value="sr" current={locale} onSelect={setLocale} />
      </div>
      {/* A glyph, not the word — the same reason admin-web already gives: the word is the only
          element in this bar whose width changes with the language AND with the current theme, and
          at 390px it was the 18px that pushed the whole bar off the screen. */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={nextThemeLabel}
        title={nextThemeLabel}
        className="grid size-9 cursor-pointer place-items-center rounded-lg border border-mri-border2 bg-transparent text-mri-text2 transition-colors hover:border-mri-text2 hover:text-mri-text"
      >
        {resolvedTheme === 'dark' ? (
          <Sun className="size-4" aria-hidden="true" />
        ) : (
          <Moon className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
