/// <reference types="vite/client" />
import '@fontsource-variable/figtree/index.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'

import { createRootAuthBeforeLoad, SESSION_ROUTE_STALE_MS } from '@mr/auth/route-guards'
import { LOCALE_BOOTSTRAP_SCRIPT, m } from '@mr/i18n'
import { buildThemeBootstrapScript } from '@mr/shared'
import { Toaster } from '@mr/ui'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'

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
    ],
    links: [{ rel: 'stylesheet', href: globalsCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = useLocale()
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LOCALE_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: buildThemeBootstrapScript('dark') }} />
        <HeadContent />
      </head>
      <body suppressHydrationWarning className="antialiased">
        <div key={locale}>{children}</div>
        <Toaster position="bottom-center" />
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
        <Scripts />
      </body>
    </html>
  )
}
