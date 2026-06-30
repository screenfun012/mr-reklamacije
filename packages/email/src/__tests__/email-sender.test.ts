import { afterEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}))

import { createEmailSender, createNoopEmailSender } from '../email-sender.js'

afterEach(() => {
  vi.clearAllMocks()
})

describe('createEmailSender', () => {
  it('sends the email with the configured from address', async () => {
    sendMock.mockResolvedValueOnce({ data: { id: 'abc' }, error: null })

    const sender = createEmailSender({ apiKey: 'key', from: 'no-reply@mrengines.rs' })
    await sender.send({ to: 'klijent@firma.rs', subject: 'Aktivacija', html: '<p>link</p>' })

    expect(sendMock).toHaveBeenCalledWith({
      from: 'no-reply@mrengines.rs',
      to: 'klijent@firma.rs',
      subject: 'Aktivacija',
      html: '<p>link</p>',
    })
  })

  it('throws when Resend reports an error', async () => {
    sendMock.mockResolvedValueOnce({ data: null, error: { message: 'domain not verified' } })

    const sender = createEmailSender({ apiKey: 'key', from: 'no-reply@mrengines.rs' })

    await expect(sender.send({ to: 'klijent@firma.rs', subject: 'x', html: 'y' })).rejects.toThrow(
      /Resend send failed: domain not verified/,
    )
  })
})

describe('createNoopEmailSender', () => {
  it('resolves without sending anything', async () => {
    const sender = createNoopEmailSender()

    await expect(sender.send({ to: 'a@b.rs', subject: 's', html: 'h' })).resolves.toBeUndefined()
    expect(sendMock).not.toHaveBeenCalled()
  })
})
