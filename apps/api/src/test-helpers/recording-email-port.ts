import type { EmailMessage, EmailPort } from '../core/ports/email-port.js'

/** Test email port that records sent messages (and can simulate send failures). */
export class RecordingEmailPort implements EmailPort {
  readonly enabled = true
  readonly sent: EmailMessage[] = []

  constructor(private readonly failOnSend = false) {}

  async send(message: EmailMessage): Promise<void> {
    if (this.failOnSend) {
      throw new Error('simulated send failure')
    }
    this.sent.push(message)
  }
}
