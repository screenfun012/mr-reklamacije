/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setLocale } from '@mr/i18n'

import {
  downloadBackupCodes,
  parseSecretFromTotpURI,
  TwoFactorDisableFlow,
  TwoFactorEnrollFlow,
  TwoFactorVerifyForm,
  useTwoFactor,
} from '../route-guards.js'

describe('useTwoFactor', () => {
  it('returns disabled when session lacks flag', async () => {
    const { renderHook } = await import('@testing-library/react')
    const client = {
      useSession: () => ({
        data: { user: { email: 'a@b.com' } },
        isPending: false,
      }),
    }
    const { result } = renderHook(() => useTwoFactor(client))
    expect(result.current.isEnabled).toBe(false)
    expect(result.current.isLoading).toBe(false)
  })

  it('returns enabled when twoFactorEnabled is true', async () => {
    const { renderHook } = await import('@testing-library/react')
    const client = {
      useSession: () => ({
        data: { user: { twoFactorEnabled: true } },
        isPending: false,
      }),
    }
    const { result } = renderHook(() => useTwoFactor(client))
    expect(result.current.isEnabled).toBe(true)
  })
})

describe('parseSecretFromTotpURI', () => {
  it('extracts secret query param', () => {
    const uri = 'otpauth://totp/issuer:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Test'
    expect(parseSecretFromTotpURI(uri)).toBe('JBSWY3DPEHPK3PXP')
  })
})

describe('downloadBackupCodes', () => {
  it('creates a download link', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadBackupCodes(['a', 'b'], 'codes.txt')
    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })
})

function createTwoFactorStub(overrides: {
  enable?: ReturnType<typeof vi.fn>
  verifyTotp?: ReturnType<typeof vi.fn>
  verifyBackupCode?: ReturnType<typeof vi.fn>
  disable?: ReturnType<typeof vi.fn>
  getSession?: ReturnType<typeof vi.fn>
  useSession?: () => { data: unknown; isPending: boolean }
}) {
  return {
    useSession:
      overrides.useSession ??
      (() => ({
        data: { user: { twoFactorEnabled: false } },
        isPending: false,
      })),
    twoFactor: {
      enable:
        overrides.enable ??
        vi.fn().mockResolvedValue({
          data: { totpURI: 'otpauth://totp/x?secret=ABC', backupCodes: ['1', '2'] },
        }),
      verifyTotp: overrides.verifyTotp ?? vi.fn().mockResolvedValue({ data: { status: true } }),
      verifyBackupCode:
        overrides.verifyBackupCode ??
        vi.fn().mockResolvedValue({ data: { user: { id: 'u' }, session: { token: 't' } } }),
      disable: overrides.disable ?? vi.fn().mockResolvedValue({ data: { status: true } }),
    },
    getSession: overrides.getSession ?? vi.fn().mockResolvedValue({}),
  }
}

describe('TwoFactorVerifyForm', () => {
  beforeEach(() => {
    setLocale('en')
  })

  it('submits TOTP when 6 digits entered', async () => {
    const verifyTotp = vi.fn().mockResolvedValue({ data: { status: true } })
    const getSession = vi.fn().mockResolvedValue({})
    const onSuccess = vi.fn()
    const client = createTwoFactorStub({ verifyTotp, getSession })

    const { container } = render(<TwoFactorVerifyForm authClient={client} onSuccess={onSuccess} />)

    const otpInput = container.querySelector('[data-input-otp]')
    expect(otpInput).not.toBeNull()
    fireEvent.input(otpInput as HTMLInputElement, { target: { value: '123456' } })

    await waitFor(() => expect(screen.getByRole('button', { name: 'Verify' })).not.toBeDisabled())

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith({ code: '123456', trustDevice: false })
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('passes trustDevice when checkbox is checked', async () => {
    const verifyTotp = vi.fn().mockResolvedValue({ data: { status: true } })
    const getSession = vi.fn().mockResolvedValue({})
    const client = createTwoFactorStub({ verifyTotp, getSession })

    const { container } = render(<TwoFactorVerifyForm authClient={client} />)

    fireEvent.click(screen.getByRole('checkbox'))
    const otpInput = container.querySelector('[data-input-otp]')
    expect(otpInput).not.toBeNull()
    fireEvent.input(otpInput as HTMLInputElement, { target: { value: '654321' } })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Verify' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith({ code: '654321', trustDevice: true })
    })
  })
})

describe('TwoFactorEnrollFlow', () => {
  beforeEach(() => {
    setLocale('en')
  })

  it('advances from password to QR after enable', async () => {
    const enable = vi.fn().mockResolvedValue({
      data: { totpURI: 'otpauth://totp/Test?secret=JBSWY3DPEHPK3PXP', backupCodes: ['abcdefghij'] },
    })
    const client = createTwoFactorStub({ enable })

    render(<TwoFactorEnrollFlow authClient={client} />)

    fireEvent.input(screen.getByLabelText(/password/i), { target: { value: 'super-secret-12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await waitFor(() => {
      expect(enable).toHaveBeenCalledWith({ password: 'super-secret-12' })
    })
    expect(await screen.findByText('Scan the QR code')).toBeInTheDocument()
  })
})

describe('TwoFactorDisableFlow', () => {
  beforeEach(() => {
    setLocale('en')
  })

  it('renders password step', () => {
    const client = createTwoFactorStub({})
    render(<TwoFactorDisableFlow authClient={client} />)
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
  })
})
