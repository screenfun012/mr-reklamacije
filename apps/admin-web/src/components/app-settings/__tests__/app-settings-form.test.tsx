import { setLocale } from '@mr/i18n'
import { AppSettingKey, PORTAL_SUPPORT_PHONE } from '@mr/shared'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppSettingsForm } from '../app-settings-form'

const SETTINGS_URL = '/api/app-settings'

/** Serves the overrides and records every PATCH body. */
function stubFetch(overrides: Record<string, string> = {}): { patches: unknown[] } {
  const patches: unknown[] = []
  const values = { ...overrides }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === SETTINGS_URL && init?.method === 'PATCH') {
        const body: unknown = JSON.parse(String(init.body))
        patches.push(body)
        const sent = (body as { values: Record<string, string | null> }).values
        for (const [key, value] of Object.entries(sent)) {
          // Mirrors the server: a value equal to the default is stored as no override at all.
          if (value === null || value === PORTAL_SUPPORT_PHONE) delete values[key]
          else values[key] = value
        }
        return new Response(JSON.stringify({ values }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      if (url === SETTINGS_URL) {
        return new Response(JSON.stringify({ values }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }

      throw new Error(`unexpected fetch: ${String(init?.method ?? 'GET')} ${url}`)
    }),
  )

  return { patches }
}

function renderForm(): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  render(
    <QueryClientProvider client={queryClient}>
      <AppSettingsForm />
    </QueryClientProvider>,
  )
}

describe('the app settings form', () => {
  beforeEach(() => {
    setLocale('sr', { reload: false })
  })

  it('shows the code default, marked as such, when nothing is overridden', async () => {
    stubFetch()
    renderForm()

    expect(await screen.findByDisplayValue(PORTAL_SUPPORT_PHONE)).toBeInTheDocument()
    // One badge per setting: every one of them is still on its default.
    expect(screen.getAllByText('Podrazumevano')).toHaveLength(4)
  })

  it('sends ONLY the setting that was edited', async () => {
    const { patches } = stubFetch()
    renderForm()

    const phone = await screen.findByDisplayValue(PORTAL_SUPPORT_PHONE)
    await userEvent.clear(phone)
    await userEvent.type(phone, '011/222-3344')
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj izmene' }))

    await waitFor(() => expect(patches).toHaveLength(1))
    // The three untouched settings may not ride along — saving them would freeze their defaults.
    expect(patches[0]).toEqual({ values: { [AppSettingKey.SupportPhone]: '011/222-3344' } })
  })

  it('has nothing to save until something changes', async () => {
    stubFetch()
    renderForm()

    await screen.findByDisplayValue(PORTAL_SUPPORT_PHONE)

    expect(screen.getByRole('button', { name: 'Sačuvaj izmene' })).toBeDisabled()
  })

  it('puts a setting back on its default', async () => {
    const { patches } = stubFetch({ [AppSettingKey.SupportPhone]: '011/999-0000' })
    renderForm()

    await screen.findByDisplayValue('011/999-0000')
    await userEvent.click(screen.getByRole('button', { name: 'Vrati na podrazumevano' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sačuvaj izmene' }))

    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0]).toEqual({ values: { [AppSettingKey.SupportPhone]: PORTAL_SUPPORT_PHONE } })
    expect(await screen.findByDisplayValue(PORTAL_SUPPORT_PHONE)).toBeInTheDocument()
  })
})
