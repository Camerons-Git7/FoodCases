if (navigator.userAgent.includes("Firefox")) {
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: true,
    writable: false,
  });
}

function skipProxy(url) {
  try {
    const host = new URL(url).hostname;
    return (
      host === "cdn.jsdelivr.net" ||
      host.endsWith(".jsdelivr.net") ||
      host === "luminsdk.com" ||
      host.endsWith(".luminsdk.com") ||
      host === "cdnjs.cloudflare.com" ||
      host.endsWith(".cdnjs.cloudflare.com") ||
      host === "fonts.googleapis.com" ||
      host === "fonts.gstatic.com" ||
      host === "www.googletagmanager.com"
    );
  } catch {
    return false;
  }
}

importScripts("9vcrck.js");
importScripts("bwd9x/vzyras.js");

// Take over as soon as a new worker is available, and start controlling
// already-open pages immediately. Without this a rebuilt worker (e.g. a change
// to the Sapphire router) sits in "waiting" until every tab is closed, so
// fixes appear not to apply. None of the imported routers claim clients.
addEventListener("install", () => self.skipWaiting());
addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

addEventListener("fetch", (e) => {
  if (skipProxy(e.request.url)) return;
  if (_jrjsk7d.shouldRoute(e)) {
    e.respondWith(_jrjsk7d.route(e));
    return;
  }
  if (_wdgvkq9.shouldRoute(e)) {
    e.respondWith(_wdgvkq9.route(e));
  }
});
