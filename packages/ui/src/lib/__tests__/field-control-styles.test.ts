import { describe, expect, it } from 'vitest'

import { listItemInteractiveClassName } from '../field-control-styles.js'

describe('listItemInteractiveClassName', () => {
  it('includes hover, focus, and Radix highlighted states for list items', () => {
    expect(listItemInteractiveClassName).toContain('hover:bg-accent')
    expect(listItemInteractiveClassName).toContain('hover:text-accent-foreground')
    expect(listItemInteractiveClassName).toContain('focus:bg-accent')
    expect(listItemInteractiveClassName).toContain('data-[highlighted]:bg-accent')
    expect(listItemInteractiveClassName).toContain('data-[highlighted]:text-accent-foreground')
  })
})
