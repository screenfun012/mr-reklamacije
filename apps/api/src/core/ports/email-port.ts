/** A file travelling with the message, held in memory — nothing here streams. */
export interface EmailAttachment {
  readonly fileName: string
  readonly content: Buffer
  readonly mimeType: string
}

export interface EmailMessage {
  to: string
  subject: string
  html: string
  /**
   * Present only where the message IS the delivery of a file — the signed work order going to the
   * vehicle's owner. Every other email in this system is signal-only and links to a screen instead
   * (docs/05), and that stays the rule: an attachment is what you send when there is no screen to
   * point the reader at, which is exactly the case for somebody who is not a user of anything.
   */
  attachments?: readonly EmailAttachment[]
}

export interface EmailPort {
  /** Whether email delivery is configured. When false, callers should skip sending. */
  readonly enabled: boolean
  send(message: EmailMessage): Promise<void>
}
