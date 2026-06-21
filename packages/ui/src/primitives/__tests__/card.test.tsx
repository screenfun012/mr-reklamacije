import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../card.js'

describe('Card', () => {
  it('renders Card with content', () => {
    render(
      <Card data-testid="card">
        <CardContent>Hello</CardContent>
      </Card>,
    )
    expect(screen.getByTestId('card')).toBeInTheDocument()
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders all subcomponents in correct hierarchy', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('applies brand H4 typography to CardTitle', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
        </CardHeader>
      </Card>,
    )
    expect(screen.getByText('Title').className).toContain('text-h4')
  })

  it('applies default and custom classes', () => {
    render(
      <Card className="custom-card" data-testid="card">
        Test
      </Card>,
    )
    const card = screen.getByTestId('card')
    expect(card.className).toContain('custom-card')
    expect(card.className).toContain('rounded-xl')
  })
})
