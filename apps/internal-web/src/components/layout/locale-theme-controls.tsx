import { m, type Locale } from '@mr/i18n'
import { cn } from '@mr/ui'

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
 */
export function LocaleThemeControls() {
  const { locale, setLocale } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()

  const toggleTheme = (): void => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex overflow-hidden rounded-lg border border-mri-border2">
        <LocaleSegment value="en" current={locale} onSelect={setLocale} />
        <LocaleSegment value="sr" current={locale} onSelect={setLocale} />
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className="cursor-pointer rounded-lg border border-mri-border2 bg-transparent px-[13px] py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-mri-text2 transition-colors hover:border-mri-text2 hover:text-mri-text"
      >
        {resolvedTheme === 'dark' ? m.theme_light() : m.theme_dark()}
      </button>
    </div>
  )
}
