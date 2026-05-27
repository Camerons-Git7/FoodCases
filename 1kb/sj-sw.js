importScripts('/scram/scramjet.all.js');
const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
let synced = false;
self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('message', (e) => { if (e.data?.type === 'PING') e.source?.postMessage?.({ type: 'PONG' }); });
async function wfc(t) {
  if (scramjet.config && scramjet.config.prefix) return true;
  try { const c = await self.clients.matchAll({ includeUncontrolled: true }); for (const x of c) try { x.postMessage({ type: 'SCRAMJET_REQUEST_CONFIG' }); } catch (_) {} } catch (_) {}
  const s = Date.now();
  while (Date.now() - s < t) {
    if (scramjet.config && scramjet.config.prefix) return true;
    try { scramjet.config = null; await scramjet.loadConfig(); } catch (_) {}
    if (scramjet.config && scramjet.config.prefix) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return !!(scramjet.config && scramjet.config.prefix);
}
async function hr(event) {
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/scramjet/') && !url.pathname.startsWith('/scram/')) return fetch(event.request);
  if (!synced) {
    try {
      if (!scramjet.config || !scramjet.config.prefix) { if (!await wfc(4000)) return fetch(event.request); }
      scramjet.config = null;
      await scramjet.loadConfig();
      if (!scramjet.config || !scramjet.config.prefix) return fetch(event.request);
      synced = true;
    } catch (e) { return fetch(event.request); }
  }
  try {
    if (scramjet.route(event)) return await scramjet.fetch(event);
  } catch (e) {
    const m = e?.message || String(e);
    if (/prefix/.test(m)) {
      synced = false;
      try { scramjet.config = null; await scramjet.loadConfig(); if (scramjet.config && scramjet.config.prefix && scramjet.route(event)) { synced = true; return await scramjet.fetch(event); } } catch (_) {}
    }
    try { const c = await self.clients.matchAll(); for (const x of c) x.postMessage({ type: 'PROXY_ERROR', error: m, url: url.pathname }); } catch (_) {}
    return fetch(event.request);
  }
  return fetch(event.request);
}
self.addEventListener('fetch', (e) => e.respondWith(hr(e)));
