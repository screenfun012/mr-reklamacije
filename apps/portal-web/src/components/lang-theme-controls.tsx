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
  // A glyph at every width — Nikola's call (2026-08-29) over the prototype's word: the word was
  // the one control whose width changed with BOTH the language and the current theme
  // (LIGHT/DARK/SVETLA/TAMNA), and the other two apps already draw the glyph.
  const nextThemeLabel = theme === 'dark' ? m.portal_theme_light() : m.portal_theme_dark()

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex overflow-hidden rounded-lg border border-mrp-border2">
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={cn(
            'cursor-pointer font-mono font-semibold tracking-[0.08em] transition-[color,background-color,transform] active:scale-[0.97]',
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
            'cursor-pointer font-mono font-semibold tracking-[0.08em] transition-[color,background-color,transform] active:scale-[0.97]',
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
        className="relative grid size-9 cursor-pointer place-items-center rounded-lg border border-mrp-border2 bg-transparent text-mrp-text2 transition-[color,border-color,transform] after:absolute after:-inset-0.5 active:scale-[0.97] hover:border-mrp-text2 hover:text-mrp-text"
      >
        {/* Both glyphs stay mounted and cross-fade with a quarter turn — and they are the one
            thing that keeps animating while the theme flip freezes every other transition. */}
        <span className="relative grid size-4 place-items-center" aria-hidden="true">
          <Sun
            className={cn(
              'mrp-theme-glyph col-start-1 row-start-1 size-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none',
              theme === 'dark' ? 'rotate-0 opacity-100' : '-rotate-90 opacity-0',
            )}
          />
          <Moon
            className={cn(
              'mrp-theme-glyph col-start-1 row-start-1 size-4 transition-[opacity,transform] duration-300 motion-reduce:transition-none',
              theme === 'dark' ? 'rotate-90 opacity-0' : 'rotate-0 opacity-100',
            )}
          />
        </span>
      </button>
    </div>
  )
}
