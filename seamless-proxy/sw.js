const PREFIX = 'proxy/';

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const pathname = url.pathname;

    if (pathname.includes(PREFIX)) {
        // Extract target URL
        const encodedPart = pathname.split(PREFIX)[1];
        let targetUrl;
        try {
            targetUrl = atob(encodedPart.split('?')[0]); // handle query params if needed
        } catch (e) {
            return;
        }

        event.respondWith(
            fetch(targetUrl, {
                method: event.request.method,
                headers: event.request.headers,
                body: event.request.body,
                redirect: 'follow'
            }).then(async res => {
                let body = await res.text();
                const contentType = res.headers.get('content-type') || '';

                if (contentType.includes('text/html')) {
                    body = rewriteHtml(body, targetUrl);
                } else if (contentType.includes('css')) {
                    body = rewriteCss(body, targetUrl);
                } else if (contentType.includes('javascript')) {
                    body = rewriteJs(body, targetUrl);
                }

                return new Response(body, {
                    status: res.status,
                    headers: res.headers
                });
            }).catch(() => new Response('Proxy Error', {status: 502}))
        );
    }
});

function rewriteHtml(html, baseUrl) {
    const base = new URL(baseUrl);
    return html.replace(/(src|href|action|data|srcset)=["']([^"']*)["']/gi, (m, attr, val) => {
        if (val && !val.startsWith('data:') && !val.startsWith('#')) {
            const full = new URL(val, base).href;
            return `${attr}="${PREFIX}${btoa(full)}"`;
        }
        return m;
    });
}

function rewriteCss(css, baseUrl) {
    const base = new URL(baseUrl);
    return css.replace(/url\(["']?([^"')]+)["']?\)/gi, (m, val) => {
        const full = new URL(val, base).href;
        return `url("${PREFIX}${btoa(full)}")`;
    });
}

function rewriteJs(js, baseUrl) {
    // Basic - expand as needed for TikTok/GeForce
    return js;
}
