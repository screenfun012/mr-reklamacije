/** localStorage key for theme preference — must match all app theme.ts modules. */
export const THEME_STORAGE_KEY = 'mrr:theme'

/** Theme applied when the user has no stored preference. */
export type ThemeBootstrapDefault = 'system' | 'dark'

/**
 * Blocking inline script for `<head>` — resolves saved/system theme and
 * applies `.dark` + `color-scheme` on `<html>` before first paint.
 * `defaultTheme` is what a user WITHOUT a stored preference gets. Both callers pass 'dark' since
 * 2026-08-18, when admin joined internal-web's dark-first look; 'system' stays in the type because
 * it is a stored preference a person can still choose, and the script must honour it.
 */
export function buildThemeBootstrapScript(defaultTheme: ThemeBootstrapDefault): string {
  return `(function(){try{var k='${THEME_STORAGE_KEY}';var t=localStorage.getItem(k)||'${defaultTheme}';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.style.colorScheme='light';}}catch(e){}})();`
}
