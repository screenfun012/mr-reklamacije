/// <reference types="vite/client" />
import '@fontsource-variable/figtree/index.css'
import '@fontsource/jetbrains-mono/400.css'

import { createRootAuthBeforeLoad, SESSION_ROUTE_STALE_MS } from '@mr/auth/route-guards'
import { m } from '@mr/i18n'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'

import { authClient } from '~/lib/auth-client'
import { loadServerSession } from '~/lib/auth-guard'
import { useLocale } from '~/lib/locale'
import type { PortalRouterContext } from '~/router-context'
import globalsCss from '~/styles/globals.css?url'

// Inline FOUC-prevention script: applies the resolved theme class to
// <html> before React hydrates. Storage key must stay in sync with
// apps/portal-web/src/lib/theme.ts (`mrr:theme`).
const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('mrr:theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`

export const Route = createRootRouteWithContext<PortalRouterContext>()({
  staleTime: SESSION_ROUTE_STALE_MS,
  beforeLoad: createRootAuthBeforeLoad(authClient, loadServerSession),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: m.app_title_portal() },
    ],
    links: [{ rel: 'stylesheet', href: globalsCss }],
    headScripts: [{ children: themeBootstrapScript }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = useLocale()
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <div key={locale}>{children}</div>
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
        <Scripts />
      </body>
    </html>
  )
}
