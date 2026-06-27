const PREFIX = 'proxy/';

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (!url.pathname.includes(PREFIX)) return;

    const encodedPart = url.pathname.split(PREFIX)[1];
    let targetUrl;
    try {
        targetUrl = atob(encodedPart.split('?')[0]);
    } catch (e) {
        event.respondWith(new Response('Invalid URL', {status: 400}));
        return;
    }

    event.respondWith(
        fetch(targetUrl, {
            method: event.request.method,
            headers: event.request.headers,
            body: event.request.body,
            redirect: 'follow',
            credentials: 'omit'
        }).then(async res => {
            let body = await res.text();
            const contentType = res.headers.get('content-type') || '';

            if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
                body = rewriteHtml(body, targetUrl);
            } else if (contentType.includes('css')) {
                body = rewriteCss(body, targetUrl);
            }

            return new Response(body, {
                status: res.status,
                headers: res.headers
            });
        }).catch(err => {
            console.error('Proxy fetch error:', err);
            return new Response('Proxy Error: ' + err.message, {status: 502});
        })
    );
});

function rewriteHtml(html, baseUrl) {
    const base = new URL(baseUrl);
    return html.replace(/(src|href|action|data|srcset|poster)=["']([^"']*)["']/gi, (m, attr, val) => {
        if (val && !val.startsWith('data:') && !val.startsWith('#') && !val.startsWith('javascript:')) {
            try {
                const full = new URL(val, base).href;
                return `${attr}="${PREFIX}${btoa(full)}"`;
            } catch (e) {}
        }
        return m;
    });
}

function rewriteCss(css, baseUrl) {
    const base = new URL(baseUrl);
    return css.replace(/url\(["']?([^"')]+)["']?\)/gi, (m, val) => {
        try {
            const full = new URL(val, base).href;
            return `url("${PREFIX}${btoa(full)}")`;
        } catch (e) {
            return m;
        }
    });
}
