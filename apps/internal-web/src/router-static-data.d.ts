import '@tanstack/react-router'

declare module '@tanstack/react-router' {
  interface StaticDataRouteOption {
    /** This route's own segment of the top bar's trail (see internal-breadcrumbs.tsx). */
    crumb?: () => string
    /** The trail restarts here: INTERNO / NOVA REKLAMACIJA, not INTERNO / REKLAMACIJE / NOVA … */
    crumbResetsTrail?: boolean
  }
}
