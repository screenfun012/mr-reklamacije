import { useState } from 'react'

import { createFileRoute } from '@tanstack/react-router'

import { TwoFactorDisableFlow, TwoFactorEnrollFlow, useTwoFactor } from '@mr/auth/route-guards'
import { m } from '@mr/i18n'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Heading,
} from '@mr/ui'

import { internalRequireAppAccess } from '~/lib/auth-guard'
import { authClient } from '~/lib/auth-client'

export const Route = createFileRoute('/_shell/settings/security')({
  // Everyone who works in this app manages their own password and 2FA — a viewer and a
  // serviser included. The old role list left them with no way to turn 2FA on at all.
  beforeLoad: internalRequireAppAccess(),
  staticData: { crumb: m.nav_security },
  component: SecuritySettingsComponent,
})

function SecuritySettingsComponent(): React.ReactElement {
  const { isEnabled, isLoading } = useTwoFactor(authClient)
  const [showEnroll, setShowEnroll] = useState(false)
  const [showDisable, setShowDisable] = useState(false)

  return (
    <>
      <div className="space-y-6">
        <Heading level="h1">{m.nav_security()}</Heading>

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{m.security_two_factor_title()}</CardTitle>
            <CardDescription>{m.security_two_factor_description()}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">…</p>
            ) : isEnabled ? (
              <div className="space-y-3">
                <p className="text-sm text-foreground">{m.security_two_factor_status_enabled()}</p>
                <Button type="button" variant="destructive" onClick={() => setShowDisable(true)}>
                  {m.security_two_factor_disable_button()}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-foreground">{m.security_two_factor_status_disabled()}</p>
                <Button type="button" onClick={() => setShowEnroll(true)}>
                  {m.security_two_factor_enable_button()}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
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
