import type { HTMLAttributes } from 'react'

import { cn } from '../lib/cn.js'

export const HEADING_LEVELS = ['display', 'h1', 'h2', 'h3', 'h4'] as const

export type HeadingLevel = (typeof HEADING_LEVELS)[number]

export type HeadingElement = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'div' | 'span'

const HEADING_LEVEL_CLASSES: Record<HeadingLevel, string> = {
  display: 'text-display',
  h1: 'text-h1',
  h2: 'text-h2',
  h3: 'text-h3',
  h4: 'text-h4',
}

const DEFAULT_ELEMENT: Record<HeadingLevel, HeadingElement> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  h4: 'h4',
}

export interface HeadingProps extends HTMLAttributes<HTMLElement> {
  level: HeadingLevel
  as?: HeadingElement
}

export function Heading({
  level,
  as,
  className,
  children,
  ...props
}: HeadingProps): React.ReactElement {
  const Component = as ?? DEFAULT_ELEMENT[level]

  return (
    <Component className={cn('text-balance', HEADING_LEVEL_CLASSES[level], className)} {...props}>
      {children}
    </Component>
  )
}
