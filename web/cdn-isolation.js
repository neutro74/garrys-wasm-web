// CDN hosts (StaticDelivr) cannot send COOP/COEP, so the package-root service worker (cdn-sw.js) adds them.
// The first visit registers it and reloads once; resolves true when the page is cross-origin isolated.
const PARAM = '__gmod_cdn_isolation';

export async function ensureCdnIsolation() {
  if (globalThis.crossOriginIsolated) return true;
  if (!navigator.serviceWorker) return false;
  const root = new URL('../', import.meta.url);
  const key = `garrys-wasm.cdn-isolation:${root.pathname}`;
  const here = new URL(location.href);
  let guarded = here.searchParams.has(PARAM);
  try { guarded = guarded || sessionStorage.getItem(key) === '1'; } catch { /* storage blocked: the URL guard still applies */ }
  if (guarded) return false;
  try {
    await navigator.serviceWorker.register(new URL('../cdn-sw.js', import.meta.url).href, { scope: root.href });
    await navigator.serviceWorker.ready;
  } catch { return false; }
  try { sessionStorage.setItem(key, '1'); } catch { /* ignored */ }
  here.searchParams.set(PARAM, '1');
  location.replace(here.href);
  return false;
}
