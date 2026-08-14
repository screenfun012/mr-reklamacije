import { createEmailSender, type EmailSender } from '@mr/email'

import type { EmailMessage, EmailPort } from '../../core/ports/email-port.js'

/** Resend-backed email port. */
export function createResendEmailPort(apiKey: string, from: string): EmailPort {
  const sender: EmailSender = createEmailSender({ apiKey, from })

  return {
    enabled: true,
    async send(message: EmailMessage): Promise<void> {
      await sender.send({
        to: message.to,
        subject: message.subject,
        html: message.html,
        ...(message.attachments === undefined ? {} : { attachments: message.attachments }),
      })
    },
  }
}

/** Disabled email port used when Resend is not configured. */
export function createDisabledEmailPort(): EmailPort {
  return {
    enabled: false,
    async send(): Promise<void> {
      // Email disabled — nothing to send.
    },
  }
}

/** Builds the email port from env: Resend when fully configured, otherwise disabled. */
export function createEmailPort(env: {
  RESEND_API_KEY?: string | undefined
  RESEND_FROM_EMAIL?: string | undefined
}): EmailPort {
  if (env.RESEND_API_KEY !== undefined && env.RESEND_FROM_EMAIL !== undefined) {
    return createResendEmailPort(env.RESEND_API_KEY, env.RESEND_FROM_EMAIL)
  }

  return createDisabledEmailPort()
}
