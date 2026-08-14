import { Resend } from 'resend'

export interface EmailAttachmentParams {
  fileName: string
  content: Buffer
  mimeType: string
}

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  attachments?: readonly EmailAttachmentParams[]
}

export interface EmailSender {
  send(params: SendEmailParams): Promise<void>
}

export interface EmailSenderConfig {
  apiKey: string
  from: string
}

/**
 * Real Resend-backed sender. Throws if Resend reports an error so the caller can
 * decide how to handle a failed send (the activation flow treats it as non-fatal).
 */
export function createEmailSender(config: EmailSenderConfig): EmailSender {
  const resend = new Resend(config.apiKey)

  return {
    async send(params: SendEmailParams): Promise<void> {
      const { error } = await resend.emails.send({
        from: config.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        // Resend derives the type from the name when it is left out; it is stated because the one
        // thing this carries is a document somebody has to be able to open.
        ...(params.attachments === undefined
          ? {}
          : {
              attachments: params.attachments.map((attachment) => ({
                filename: attachment.fileName,
                content: attachment.content,
                contentType: attachment.mimeType,
              })),
            }),
      })

      if (error !== null) {
        throw new Error(`Resend send failed: ${error.message}`)
      }
    },
  }
}

/** No-op sender used when email is not configured (RESEND_API_KEY absent). */
export function createNoopEmailSender(): EmailSender {
  return {
    async send(): Promise<void> {
      // Intentionally does nothing — email delivery is disabled.
    },
  }
}
