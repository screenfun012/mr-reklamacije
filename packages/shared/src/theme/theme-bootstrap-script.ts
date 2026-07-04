/** localStorage key for theme preference — must match all app theme.ts modules. */
export const THEME_STORAGE_KEY = 'mrr:theme'

/** Theme applied when the user has no stored preference. */
export type ThemeBootstrapDefault = 'system' | 'dark'

/**
 * Blocking inline script for `<head>` — resolves saved/system theme and
 * applies `.dark` + `color-scheme` on `<html>` before first paint.
 * `defaultTheme` is what a user WITHOUT a stored preference gets: admin keeps
 * the OS preference ('system'), internal is dark-first per its redesign.
 */
export function buildThemeBootstrapScript(defaultTheme: ThemeBootstrapDefault): string {
  return `(function(){try{var k='${THEME_STORAGE_KEY}';var t=localStorage.getItem(k)||'${defaultTheme}';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.style.colorScheme='light';}}catch(e){}})();`
}

export const THEME_BOOTSTRAP_SCRIPT = buildThemeBootstrapScript('system')
