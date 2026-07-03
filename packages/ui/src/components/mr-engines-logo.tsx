export interface MrEnginesLogoProps {
  /**
   * Resolved theme of the host app. Passed in because the theme store
   * lives in each app (packages/ui cannot import from apps); rendering
   * a single themed <img> avoids downloading both logo variants.
   */
  theme: 'light' | 'dark'
  className?: string
}

export function MrEnginesLogo({ theme, className }: MrEnginesLogoProps) {
  return (
    <div className="flex justify-center">
      <img
        src={theme === 'dark' ? '/mr-engines-logo-dark.png' : '/mr-engines-logo-light.png'}
        alt="MR Engines"
        width={512}
        height={137}
        className={`h-9 w-auto ${className ?? ''}`}
      />
    </div>
  )
}
