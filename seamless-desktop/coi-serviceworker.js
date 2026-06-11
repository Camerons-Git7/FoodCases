/*! coi-serviceworker v0.1.7 | MIT License | https://github.com/gzguidoti/coi-serviceworker */
if (typeof window === 'undefined') {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("fetch", (event) => {
        if (event.request.cache === "only-if-cached" && event.request.mode !== "same-origin") {
            return;
        }

        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.status === 0) {
                        return response;
                    }

                    const newHeaders = new Headers(response.headers);
                    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");

                    return new Response(response.body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: newHeaders,
                    });
                })
                .catch((e) => {
                    console.error("COOP/COEP Service Worker fetch error:", e);
                })
        );
    });
} else {
    // Inside browser window context: register the service worker
    (() => {
        const script = document.currentScript;
        const reloadedKey = "coiNoReload";
        
        // Check if browser supports service workers
        if (!("serviceWorker" in navigator)) {
            console.warn("Service workers are not supported by this browser.");
            return;
        }

        // Determine registration path
        let swPath = "/coi-serviceworker.js";
        if (script) {
            const src = script.getAttribute("src");
            if (src) {
                swPath = src;
            }
        }

        navigator.serviceWorker.register(swPath).then((registration) => {
            registration.addEventListener("updatefound", () => {
                // If a new worker is found, force reload once it becomes active
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.addEventListener("statechange", () => {
                        if (installingWorker.state === "activated") {
                            window.location.reload();
                        }
                    });
                }
            });

            // If the controller isn't active yet, reload the page to apply headers
            if (!navigator.serviceWorker.controller) {
                if (!sessionStorage.getItem(reloadedKey)) {
                    sessionStorage.setItem(reloadedKey, "true");
                    window.location.reload();
                }
            } else {
                sessionStorage.removeItem(reloadedKey);
            }
        }).catch((err) => {
            console.error("COOP/COEP Service Worker registration failed: ", err);
        });
    })();
}