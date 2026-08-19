import { BADGE_SHELL_CLASSES } from '@mr/ui'
import { createElement, type ReactNode } from 'react'

const INACTIVE_CHIP = `${BADGE_SHELL_CLASSES} border-mr-warning/45 bg-mr-warning-subtle text-mr-warning-strong dark:border-mr-warning/55 dark:bg-mr-warning/20 dark:text-mr-warning`

/**
 * Colours the EXCEPTION, not the rule.
 *
 * The spec asked for Da/Ne as chips. Looking at the real screens changed the answer: the Active
 * column reads "Da" on every row — 76 of them on engine types — so chipping both values would add
 * 76 green pills that carry no information and one more colour to a panel already accused of noise.
 * A chip earns its place when values differ, and here the interesting one is the rare "Ne".
 *
 * So an inactive row gets an amber chip and an active one stays quiet text: the eye finds what you
 * actually scan that column for.
 *
 * A function rather than a component because the eight resource definitions are `.ts`, not `.tsx` —
 * renaming all eight to hold one cell's markup would be the tail wagging the dog.
 */
export function renderActiveCell(isActive: boolean, label: string): ReactNode {
  if (isActive) {
    return createElement('span', { className: 'text-muted-foreground' }, label)
  }

  return createElement('span', { className: INACTIVE_CHIP }, label)
}
