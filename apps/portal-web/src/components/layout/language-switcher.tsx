import { m, type Locale } from '@mr/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@mr/ui'
import { Globe } from 'lucide-react'

import { useLocale } from '~/lib/locale'

// Standalone locale picker for screens without the user menu (e.g. login).
// SR/EN today; B.3 extends this to the full six-language set.
const LOCALE_LABELS: Record<Locale, () => string> = {
  sr: m.language_serbian,
  en: m.language_english,
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={m.language_label()}
        className="inline-flex items-center gap-2 rounded-md border border-mr-border-strong px-3 py-1.5 text-sm text-mr-text-body transition-colors hover:bg-mr-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span className="font-mono text-xs uppercase">{locale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => setLocale(value as Locale)}
        >
          <DropdownMenuRadioItem value="sr">
            <Globe aria-hidden="true" />
            <span>{LOCALE_LABELS.sr()}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en">
            <Globe aria-hidden="true" />
            <span>{LOCALE_LABELS.en()}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
