import { describe, expect, it } from 'vitest'

import {
  dataTableDestructiveActionClassName,
  dataTableIconActionClassName,
  dataTableRowHoverOnlyClassName,
  dataTableRowInteractiveClassName,
  dataTableRowNavigableClassName,
  dataTableTextActionClassName,
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

describe('dataTableRowNavigableClassName', () => {
  it('combines border, hover, and pointer cursor for internal list rows', () => {
    expect(dataTableRowNavigableClassName).toContain('cursor-pointer')
    expect(dataTableRowNavigableClassName).toContain(dataTableRowInteractiveClassName)
  })
})

describe('dataTableRowHoverOnlyClassName', () => {
  it('combines border and hover without navigation cursor', () => {
    expect(dataTableRowHoverOnlyClassName).toContain(dataTableRowInteractiveClassName)
    expect(dataTableRowHoverOnlyClassName).not.toContain('cursor-pointer')
  })
})

describe('dataTable action classes', () => {
  it('keeps icon and text actions visually subordinate to row hover', () => {
    expect(dataTableIconActionClassName).toContain('text-muted-foreground')
    expect(dataTableIconActionClassName).toContain('hover:bg-muted/60')
    expect(dataTableTextActionClassName).toContain('hover:bg-muted/60')
    expect(dataTableDestructiveActionClassName).toContain('hover:bg-destructive/10')
  })
})
