import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs.js'

describe('Tabs', () => {
  it('renders triggers and shows active panel content', async () => {
    const user = userEvent.setup()

    render(
      <Tabs defaultValue="overview">
        <TabsList aria-label="Claim sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="faults">Faults</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="faults">Faults panel</TabsContent>
      </Tabs>,
    )

    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Overview panel')).toBeVisible()
    expect(screen.queryByText('Faults panel')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Faults' }))

    expect(screen.getByRole('tab', { name: 'Faults' })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('Faults panel')).toBeVisible()
  })

  it('calls onValueChange when switching tabs', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()

    render(
      <Tabs value="overview" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="faults">Faults</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">Overview panel</TabsContent>
        <TabsContent value="faults">Faults panel</TabsContent>
      </Tabs>,
    )

    await user.click(screen.getByRole('tab', { name: 'Faults' }))

    expect(onValueChange).toHaveBeenCalledWith('faults')
  })
})
