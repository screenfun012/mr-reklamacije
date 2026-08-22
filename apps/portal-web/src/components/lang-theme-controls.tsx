import { m } from '@mr/i18n'
import { cn } from '@mr/ui'
import { Moon, Sun } from 'lucide-react'

import { useLocale } from '@mr/ui'
import { usePortalTheme } from '~/lib/theme'

const SEGMENT_ACTIVE = 'bg-mrp-red text-white'
const SEGMENT_IDLE = 'bg-transparent text-mrp-text2 hover:text-mrp-text'

/** EN | SR segmented control + LIGHT/DARK outline chip (header + login corner). */
export function LangThemeControls({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale()
  const { theme, toggleTheme } = usePortalTheme()

  const segmentPad = compact ? 'px-[11px] py-1.5 text-[11px]' : 'px-3 py-[7px] text-[11.5px]'
  // The word is kept from sm up, where the prototype drew it. Below sm it becomes a glyph: on a
  // 390px phone the header ran 57px past the edge, and this chip is the one control whose width
  // changes with BOTH the language and the current theme (LIGHT/DARK/SVETLA/TAMNA).
  const chipPad = compact
    ? 'sm:px-[13px] sm:py-1.5 sm:text-[11px]'
    : 'sm:px-3.5 sm:py-[7px] sm:text-[11.5px]'
  const nextThemeLabel = theme === 'dark' ? m.portal_theme_light() : m.portal_theme_dark()

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
        aria-label={nextThemeLabel}
        title={nextThemeLabel}
        className={cn(
          'grid size-9 cursor-pointer place-items-center rounded-lg border border-mrp-border2 bg-transparent font-mono font-semibold tracking-[0.08em] text-mrp-text2 transition-colors hover:border-mrp-text2 hover:text-mrp-text sm:block sm:size-auto',
          chipPad,
        )}
      >
        {theme === 'dark' ? (
          <Sun className="size-4 sm:hidden" aria-hidden="true" />
        ) : (
          <Moon className="size-4 sm:hidden" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{nextThemeLabel}</span>
      </button>
    </div>
  )
}
