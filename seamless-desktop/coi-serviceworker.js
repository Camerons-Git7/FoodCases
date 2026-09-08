/*! coi-serviceworker + asset cache | based on v0.1.7 MIT */
if (typeof window === 'undefined') {
    const CACHE_NAME = 'seamless-desktop-v1';
    // Paths we want to cache after first successful fetch
    const CACHEABLE_SUFFIXES = [
        'parsecd.wasm',
        'lib/matoya.js',
        'lib/matoya-worker.js',
        'lib/weblib.js',
        'lib/parsec.js',
        'coi-serviceworker.js',
        'index.html'
    ];

    self.addEventListener('install', () => self.skipWaiting());

    self.addEventListener('activate', (event) => {
        event.waitUntil(
            caches.keys().then((names) =>
                Promise.all(
                    names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
                )
            ).then(() => self.clients.claim())
        );
    });

    function shouldCache(url) {
        try {
            const u = new URL(url);
            if (u.origin !== self.location.origin) return false;
            const path = u.pathname;
            return CACHEABLE_SUFFIXES.some((f) => path.endsWith('/' + f) || path.endsWith(f));
        } catch (e) {
            return false;
        }
    }

    self.addEventListener('fetch', (event) => {
        if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') {
            return;
        }

        const req = event.request;

        event.respondWith((async () => {
            // Cache-first for our static assets
            if (req.method === 'GET' && shouldCache(req.url)) {
                const cache = await caches.open(CACHE_NAME);
                const cached = await cache.match(req);
                if (cached) {
                    const headers = new Headers(cached.headers);
                    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
                    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
                    return new Response(cached.body, {
                        status: cached.status,
                        statusText: cached.statusText,
                        headers
                    });
                }
            }

            // Network
            try {
                const response = await fetch(req);
                if (response.status === 0) return response;

                // Store successful responses for our assets
                if (req.method === 'GET' && response.ok && shouldCache(req.url)) {
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(req, response.clone()).catch(() => {});
                }

                const newHeaders = new Headers(response.headers);
                newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
                newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');

                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: newHeaders
                });
            } catch (e) {
                console.error('COOP/COEP + cache SW fetch error:', e);
                const cache = await caches.open(CACHE_NAME);
                const cached = await cache.match(req);
                if (cached) return cached;
                throw e;
            }
        })());
    });
} else {
    // Browser context: register the service worker
    (() => {
        const script = document.currentScript;
        const reloadedKey = 'coiNoReload';

        if (!('serviceWorker' in navigator)) {
            console.warn('Service workers are not supported by this browser.');
            return;
        }

        // Prefer relative path so it works under /seamless-desktop/
        let swPath = 'coi-serviceworker.js';
        if (script) {
            const src = script.getAttribute('src');
            if (src) swPath = src;
        }

        navigator.serviceWorker.register(swPath).then((registration) => {
            registration.addEventListener('updatefound', () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.addEventListener('statechange', () => {
                        if (installingWorker.state === 'activated') {
                            window.location.reload();
                        }
                    });
                }
            });

            if (!navigator.serviceWorker.controller) {
                if (!sessionStorage.getItem(reloadedKey)) {
                    sessionStorage.setItem(reloadedKey, 'true');
                    window.location.reload();
                }
            } else {
                sessionStorage.removeItem(reloadedKey);
            }
        }).catch((err) => {
            console.error('COOP/COEP Service Worker registration failed: ', err);
        });
    })();
}
