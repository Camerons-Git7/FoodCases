importScripts('/uv/uv.bundle.js');
importScripts('/uv/uv.config.js');
importScripts('/uv/uv.sw.js');
const sw = new UVServiceWorker();
self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (event) => {
    try {
        const url = new URL(event.request.url);
        if (!url.pathname.startsWith(self.__uv$config.prefix)) return;
        const encodedPath = url.pathname.slice(self.__uv$config.prefix.length);
        if (!encodedPath || encodedPath.length === 0) return;
        event.respondWith(
            sw.fetch(event).catch(err => {
                return new Response(`<html><head><title>Error</title></head><body style="font-family:sans-serif;background:#111;color:#ccc;padding:40px;text-align:center"><h2 style="color:#f66">Connection Error</h2><p style="color:#aaa">${err.message}</p></body></html>`, {
                    status: 500,
                    headers: { 'Content-Type': 'text/html' }
                });
            })
        );
    } catch (e) {}
});
