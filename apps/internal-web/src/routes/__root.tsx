/// <reference types="vite/client" />
import '@fontsource-variable/figtree/index.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'

import {
  AuthProvider,
  createRootAuthBeforeLoad,
  SESSION_ROUTE_STALE_MS,
} from '@mr/auth/route-guards'
import { useEffect } from 'react'

import { LOCALE_BOOTSTRAP_SCRIPT, m } from '@mr/i18n'
import { buildThemeBootstrapScript } from '@mr/shared'
import { Toaster } from '@mr/ui'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'

import { registerServiceWorker } from '~/lib/register-service-worker'
import { authClient } from '~/lib/auth-client'
import { loadServerSession } from '~/lib/auth-guard'
import { useLocale } from '@mr/ui'
import type { InternalRouterContext } from '~/router-context'
import globalsCss from '~/styles/globals.css?url'

export const Route = createRootRouteWithContext<InternalRouterContext>()({
  staleTime: SESSION_ROUTE_STALE_MS,
  beforeLoad: createRootAuthBeforeLoad(authClient, loadServerSession),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: m.app_title_internal() },
      { name: 'description', content: m.internal_login_subtitle() },
      // Open Graph / Twitter — a representative preview card when the link is shared.
      // og:image and og:url must be absolute (platforms fetch them server-side), so the
      // production host is spelled out here rather than derived from a relative path.
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: m.app_title_internal() },
      { property: 'og:description', content: m.internal_login_subtitle() },
      { property: 'og:image', content: 'https://internal.mrclaims.live/internal/bg-workshop.jpg' },
      { property: 'og:url', content: 'https://internal.mrclaims.live' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: m.app_title_internal() },
      { name: 'twitter:description', content: m.internal_login_subtitle() },
      { name: 'twitter:image', content: 'https://internal.mrclaims.live/internal/bg-workshop.jpg' },
    ],
    links: [
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      /*
       * ⚠ The manifest and this icon are what make push possible AT ALL on an iPhone or iPad.
       * Safari refuses `Notification.requestPermission` from an ordinary tab; the app has to be
       * added to the Home Screen first, and it cannot be added without a manifest.
       *
       * The icon is the plain MR mark rather than the emblem — measured 2026-08-23: the emblem is
       * beautiful at 180px and turns to a smudge at 60.
       */
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'stylesheet', href: globalsCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = useLocale()

  /*
   * Registering only — never asking. The browser is told the worker exists so a notification can be
   * drawn later; the permission question is asked when a person presses the button, because a
   * prompt fired on load is answered with a permanent refusal the app can never undo.
   */
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript('dark') }} />
        <HeadContent />
      </head>
      <body suppressHydrationWarning className="antialiased">
        <div key={locale}>
          <AuthProvider authClient={authClient}>{children}</AuthProvider>
        </div>
        <Toaster position="bottom-center" />
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
        <Scripts />
      </body>
    </html>
  )
}
