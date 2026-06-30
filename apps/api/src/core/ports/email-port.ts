export interface EmailMessage {
  to: string
  subject: string
  html: string
}

export interface EmailPort {
  /** Whether email delivery is configured. When false, callers should skip sending. */
  readonly enabled: boolean
  send(message: EmailMessage): Promise<void>
}
