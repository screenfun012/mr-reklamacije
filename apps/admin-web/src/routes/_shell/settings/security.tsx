import { useState } from 'react'

import { createFileRoute } from '@tanstack/react-router'

import { TwoFactorDisableFlow, TwoFactorEnrollFlow, useTwoFactor } from '@mr/auth/route-guards'
import { m } from '@mr/i18n'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@mr/ui'

import { authClient } from '~/lib/auth-client'
import { admPrimaryButtonClassName, admSecondaryButtonClassName } from '~/lib/adm-chrome'

export const Route = createFileRoute('/_shell/settings/security')({
  component: SecuritySettingsComponent,
})

function SecuritySettingsComponent(): React.ReactElement {
  const { isEnabled, isLoading } = useTwoFactor(authClient)
  const [showEnroll, setShowEnroll] = useState(false)
  const [showDisable, setShowDisable] = useState(false)

  return (
    <>
      <div className="flex max-w-[640px] flex-col gap-4">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em] text-foreground">
          {m.nav_security()}
        </h1>

        <section className="rounded-[14px] border border-border bg-card px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[14.5px] font-extrabold text-foreground">
              {m.security_two_factor_title()}
            </h2>
            {isLoading ? null : (
              // The state first, as a pill: this screen has exactly one fact on it, and it should
              // be readable before the paragraph explaining what it means.
              <span
                className={`rounded-full px-2.5 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.06em] ${
                  isEnabled ? 'bg-adm-grn/15 text-adm-grn' : 'bg-adm-gry/20 text-adm-gry'
                }`}
              >
                {isEnabled
                  ? m.security_two_factor_status_enabled()
                  : m.security_two_factor_status_disabled()}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[12.5px] leading-[1.55] text-muted-foreground">
            {m.security_two_factor_description()}
          </p>

          {isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">…</p>
          ) : (
            <button
              type="button"
              className={`mt-3.5 flex-none px-6 ${
                isEnabled
                  ? `${admSecondaryButtonClassName} border-mr-brand/40 text-adm-red-h`
                  : admPrimaryButtonClassName
              }`}
              onClick={() => (isEnabled ? setShowDisable(true) : setShowEnroll(true))}
            >
              {isEnabled
                ? m.security_two_factor_disable_button()
                : m.security_two_factor_enable_button()}
            </button>
          )}
        </section>
      </div>

      <Dialog open={showEnroll} onOpenChange={setShowEnroll}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{m.security_2fa_enable_title()}</DialogTitle>
            <DialogDescription>{m.security_2fa_enable_description()}</DialogDescription>
          </DialogHeader>
          <TwoFactorEnrollFlow
            authClient={authClient}
            onComplete={() => setShowEnroll(false)}
            onCancel={() => setShowEnroll(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showDisable} onOpenChange={setShowDisable}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{m.security_2fa_disable_title()}</DialogTitle>
            <DialogDescription>{m.security_2fa_disable_description()}</DialogDescription>
          </DialogHeader>
          <TwoFactorDisableFlow
            authClient={authClient}
            onComplete={() => setShowDisable(false)}
            onCancel={() => setShowDisable(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
