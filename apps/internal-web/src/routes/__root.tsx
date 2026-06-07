/// <reference types="vite/client" />
import '@fontsource-variable/figtree/index.css'
import '@fontsource/jetbrains-mono/400.css'

import { createRootAuthBeforeLoad, SESSION_ROUTE_STALE_MS } from '@mr/auth/route-guards'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'

import { authClient } from '~/lib/auth-client'
import { loadServerSession } from '~/lib/auth-guard'
import { useLocale } from '~/lib/locale'
import type { InternalRouterContext } from '~/router-context'
import globalsCss from '~/styles/globals.css?url'

// Inline FOUC-prevention script: applies the resolved theme class to
// <html> before React hydrates. Runs synchronously in <head> so the
// first paint already matches the user's saved theme. Storage key
// must stay in sync with apps/internal-web/src/lib/theme.ts (`mrr:theme`).
const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('mrr:theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d){document.documentElement.classList.add('dark');}}catch(e){}})();`

export const Route = createRootRouteWithContext<InternalRouterContext>()({
  staleTime: SESSION_ROUTE_STALE_MS,
  beforeLoad: createRootAuthBeforeLoad(authClient, loadServerSession),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'MR Reklamacije Internal' },
    ],
    links: [{ rel: 'stylesheet', href: globalsCss }],
    headScripts: [{ children: themeBootstrapScript }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = useLocale()
  return (
    <html lang="sr" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <div key={locale}>{children}</div>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
