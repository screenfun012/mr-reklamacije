/** localStorage key for theme preference — must match all app theme.ts modules. */
export const THEME_STORAGE_KEY = 'mrr:theme'

/**
 * Blocking inline script for `<head>` — resolves saved/system theme and
 * applies `.dark` + `color-scheme` on `<html>` before first paint.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var t=localStorage.getItem(k)||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(d){r.classList.add('dark');r.style.colorScheme='dark';}else{r.classList.remove('dark');r.style.colorScheme='light';}}catch(e){}})();`
