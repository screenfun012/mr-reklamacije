import { describe, expect, it } from 'vitest'

import {
  dataTableRowInteractiveClassName,
  listItemInteractiveClassName,
} from '../field-control-styles.js'

describe('listItemInteractiveClassName', () => {
  it('uses preset CSS class for list item hover states', () => {
    expect(listItemInteractiveClassName).toBe('mr-list-item-interactive')
  })
})

describe('dataTableRowInteractiveClassName', () => {
  it('includes muted row hover for data tables', () => {
    expect(dataTableRowInteractiveClassName).toContain('hover:bg-muted/40')
    expect(dataTableRowInteractiveClassName).toContain('transition-colors')
  })
})
