import { m } from '@mr/i18n'
import { cn } from '@mr/ui'

import { useLocale } from '@mr/ui'
import { usePortalTheme } from '~/lib/theme'

const SEGMENT_ACTIVE = 'bg-mrp-red text-white'
const SEGMENT_IDLE = 'bg-transparent text-mrp-text2 hover:text-mrp-text'

/** EN | SR segmented control + LIGHT/DARK outline chip (header + login corner). */
export function LangThemeControls({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale()
  const { theme, toggleTheme } = usePortalTheme()

  const segmentPad = compact ? 'px-[11px] py-1.5 text-[11px]' : 'px-3 py-[7px] text-[11.5px]'
  const chipPad = compact ? 'px-[13px] py-1.5 text-[11px]' : 'px-3.5 py-[7px] text-[11.5px]'

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex overflow-hidden rounded-lg border border-mrp-border2">
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={cn(
            'cursor-pointer font-mono font-semibold tracking-[0.08em] transition-colors',
            segmentPad,
            locale === 'en' ? SEGMENT_ACTIVE : SEGMENT_IDLE,
          )}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => setLocale('sr')}
          className={cn(
            'cursor-pointer font-mono font-semibold tracking-[0.08em] transition-colors',
            segmentPad,
            locale === 'sr' ? SEGMENT_ACTIVE : SEGMENT_IDLE,
          )}
        >
          SR
        </button>
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className={cn(
          'cursor-pointer rounded-lg border border-mrp-border2 bg-transparent font-mono font-semibold tracking-[0.08em] text-mrp-text2 transition-colors hover:border-mrp-text2 hover:text-mrp-text',
          chipPad,
        )}
      >
        {theme === 'dark' ? m.portal_theme_light() : m.portal_theme_dark()}
      </button>
    </div>
  )
}
