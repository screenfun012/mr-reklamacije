import { setUserPassword, type Auth } from '@mr/auth'
import type { Logger } from '@mr/logger'

import { ValidationError } from '../../core/errors/domain-errors.js'
import type {
  ActivatableUser,
  ClientActivationPort,
} from '../../core/ports/client-activation-port.js'
import type { EmailPort } from '../../core/ports/email-port.js'
import type { AppSettingsReader } from '../../core/settings/app-settings.reader.js'
import { activationEmailSubject, renderActivationEmailHtml } from './activation.email.js'
import type { ActivationRepository } from './activation.repository.js'
import type { ActivationCompleteInput } from './activation.validators.js'

export class ActivationService implements ClientActivationPort {
  constructor(
    private readonly repo: ActivationRepository,
    private readonly email: EmailPort,
    private readonly auth: Auth,
    private readonly portalBaseUrl: string,
    private readonly appSettings: AppSettingsReader,
    private readonly logger: Logger,
  ) {}

  /**
   * Mint a fresh activation token and email the link. Returns whether the email
   * was sent. Never throws — a failed send must not break the calling approval.
   */
  async sendActivationFor(user: ActivatableUser): Promise<boolean> {
    if (!this.email.enabled) {
      return false
    }

    try {
      const rawToken = await this.repo.mint(user.id)
      const url = `${this.portalBaseUrl}/activate?token=${encodeURIComponent(rawToken)}`
      const locale = user.preferredLanguage
      const settings = await this.appSettings.resolveAll()

      await this.email.send({
        to: user.email,
        subject: activationEmailSubject(locale),
        html: renderActivationEmailHtml({
          name: user.name,
          url,
          locale,
          supportPhone: settings.supportPhone,
          supportEmail: settings.supportEmail,
        }),
      })

      return true
    } catch (error) {
      this.logger.error({ err: error, userId: user.id }, 'Failed to send activation email')
      return false
    }
  }

  /** Set the client's first password from a one-time token. */
  async completeActivation(input: ActivationCompleteInput): Promise<void> {
    const userId = await this.repo.consume(input.token)
    if (userId === null) {
      throw new ValidationError('Aktivacioni link je nevažeći ili je istekao.')
    }

    await setUserPassword(this.auth, userId, input.newPassword)
  }
}
