/// <reference types="vite/client" />
import '@fontsource-variable/figtree/index.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
// Preload the primary woff2 subsets so the first paint uses the real fonts
// instead of a system fallback that then swaps in (the main refresh flicker).
import figtreeLatinWoff2 from '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url'
import figtreeLatinExtWoff2 from '@fontsource-variable/figtree/files/figtree-latin-ext-wght-normal.woff2?url'
import jetbrainsMono400Woff2 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url'
import jetbrainsMono600Woff2 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2?url'
import jetbrainsMono700Woff2 from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?url'

import {
  AuthProvider,
  createRootAuthBeforeLoad,
  SESSION_ROUTE_STALE_MS,
} from '@mr/auth/route-guards'
import { m, PORTAL_LOCALE_BOOTSTRAP_SCRIPT, syncPortalRequestLocale } from '@mr/i18n'
import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import type { ReactNode } from 'react'

import { Toaster, useLocale } from '@mr/ui'

import { authClient } from '~/lib/auth-client'
import { loadServerSession } from '~/lib/auth-guard'
import { THEME_BOOTSTRAP_SCRIPT, usePortalTheme } from '~/lib/theme'
import type { PortalRouterContext } from '~/router-context'
import globalsCss from '~/styles/globals.css?url'

const FONT_PRELOADS = [
  figtreeLatinWoff2,
  figtreeLatinExtWoff2,
  jetbrainsMono400Woff2,
  jetbrainsMono600Woff2,
  jetbrainsMono700Woff2,
].map(
  (href) =>
    ({
      rel: 'preload',
      href,
      as: 'font',
      type: 'font/woff2',
      crossOrigin: 'anonymous',
    }) as const,
)

const rootAuthBeforeLoad = createRootAuthBeforeLoad(authClient, loadServerSession)

export const Route = createRootRouteWithContext<PortalRouterContext>()({
  staleTime: SESSION_ROUTE_STALE_MS,
  beforeLoad: async () => {
    const session = await rootAuthBeforeLoad()
    // Re-pin the SSR locale with the PORTAL resolution (cookie or default EN) —
    // the shared root beforeLoad pins via Accept-Language, which the portal
    // deliberately ignores. Must run after it so the portal default wins.
    const locale = await syncPortalRequestLocale()
    return { ...session, locale }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: m.app_title_portal() },
      { name: 'description', content: m.portal_login_subtitle() },
      // Open Graph / Twitter — a representative preview card when a client shares the link.
      // og:image/og:url must be absolute (platforms fetch them server-side); portal is the apex.
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: m.app_title_portal() },
      { property: 'og:description', content: m.portal_login_subtitle() },
      { property: 'og:image', content: 'https://mrclaims.live/portal/bg-workshop.jpg' },
      { property: 'og:url', content: 'https://mrclaims.live' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: m.app_title_portal() },
      { name: 'twitter:description', content: m.portal_login_subtitle() },
      { name: 'twitter:image', content: 'https://mrclaims.live/portal/bg-workshop.jpg' },
    ],
    links: [
      { rel: 'icon', type: 'image/png', href: '/favicon.png' },
      { rel: 'apple-touch-icon', href: '/favicon.png' },
      ...FONT_PRELOADS,
      { rel: 'stylesheet', href: globalsCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = useLocale()
  // SSR renders the dark default; THEME_BOOTSTRAP_SCRIPT corrects the class
  // before first paint and usePortalTheme keeps re-renders consistent with it.
  const { theme } = usePortalTheme()

  return (
    <html lang={locale} className={theme} style={{ colorScheme: theme }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PORTAL_LOCALE_BOOTSTRAP_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <HeadContent />
      </head>
      <body suppressHydrationWarning className="bg-mrp-bg font-sans text-mrp-text antialiased">
        <div key={locale}>
          <AuthProvider authClient={authClient}>{children}</AuthProvider>
        </div>
        <Toaster position="bottom-center" theme={theme} />
        {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
        <Scripts />
      </body>
    </html>
  )
}
