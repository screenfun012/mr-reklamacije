import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-display',
        'text-h1',
        'text-h2',
        'text-h3',
        'text-h4',
        'text-body-lg',
        'text-caption',
        'text-micro',
      ],
    },
  },
})

/**
 * Combines conditional class names (via clsx) and resolves
 * conflicting Tailwind utilities (via tailwind-merge).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
