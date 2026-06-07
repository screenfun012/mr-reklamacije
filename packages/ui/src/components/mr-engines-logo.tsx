export interface MrEnginesLogoProps {
  className?: string
}

export function MrEnginesLogo({ className }: MrEnginesLogoProps) {
  return (
    <div className="flex justify-center">
      <img
        src="/mr-engines-logo-light.png"
        alt="MR Engines"
        className={`h-9 w-auto dark:hidden ${className ?? ''}`}
      />
      <img
        src="/mr-engines-logo-dark.png"
        alt="MR Engines"
        className={`hidden h-9 w-auto dark:block ${className ?? ''}`}
      />
    </div>
  )
}
