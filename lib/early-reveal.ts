/**
 * Inline, pre-paint: mark the document when the prerendered HTML is exactly what the URL asks
 * for, so the shell can show before the JavaScript arrives. The prerender is the governed view in
 * the light theme; a demo, live or dark link, or a presenter link, waits for the client as before.
 * No route path may appear literally in this script: the static build rewrites absolute paths
 * for the Pages subpath, and would rewrite them here too.
 * `motion-early` lets the hero animations run from CSS at first paint, once, so they neither wait
 * for nor replay at hydration. Reduced motion and background tabs get no animation.
 */
export const EARLY_REVEAL_SCRIPT = `(function(){try{
var p=new URLSearchParams(location.search),m=(p.get('mode')||'').toLowerCase();
var governed=!m||m==='governed'||m==='sample';
if(!governed||p.get('theme')==='dark'||p.get('present')==='1'||(location.pathname.indexOf('diagnostics')>-1&&/(demo|live)-/.test(location.pathname)))return;
var d=document.documentElement;d.setAttribute('data-boot','early');
if(document.visibilityState!=='hidden'&&!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))d.classList.add('motion-early');
}catch(e){}})();`;

/** True when the page was shown before hydration, so anything already on screen has been seen. */
export function revealedEarly(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-boot') === 'early';
}
