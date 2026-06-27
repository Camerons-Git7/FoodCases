<?php header('Content-Type: text/html; charset=utf-8'); ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Seamless Proxy</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #111; color: #fff; }
        input, button { padding: 10px; margin: 5px; font-size: 16px; }
    </style>
</head>
<body>
    <h1>Seamless Proxy (Single File)</h1>
    <input type="text" id="url" placeholder="https://tiktok.com" style="width: 70%;">
    <button onclick="go()">Proxy Site</button>

    <script>
        const PREFIX = 'proxy/';

        async function go() {
            let input = document.getElementById('url').value.trim();
            if (!input.startsWith('http')) input = 'https://' + input;
            const encoded = btoa(input);
            window.location.href = PREFIX + encoded;
        }

        // Service Worker (embedded)
        if ('serviceWorker' in navigator) {
            const swCode = `
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (!url.pathname.includes('${PREFIX}')) return;

    const encodedPart = url.pathname.split('${PREFIX}')[1];
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
            redirect: 'follow'
        }).then(async res => {
            let body = await res.text();
            const ct = res.headers.get('content-type') || '';

            if (ct.includes('text/html')) {
                body = rewriteHtml(body, targetUrl);
            } else if (ct.includes('css')) {
                body = rewriteCss(body, targetUrl);
            }

            return new Response(body, { status: res.status, headers: res.headers });
        }).catch(() => new Response('Proxy Error', {status: 502}))
    );
});

function rewriteHtml(html, base) {
    const b = new URL(base);
    return html.replace(/(src|href|action|data|srcset)=["']([^"']*)["']/gi, (m, attr, val) => {
        if (val && !val.startsWith('data:') && !val.startsWith('#')) {
            try {
                const full = new URL(val, b).href;
                return attr + '="${PREFIX}' + btoa(full) + '"';
            } catch(e) {}
        }
        return m;
    });
}

function rewriteCss(css, base) {
    const b = new URL(base);
    return css.replace(/url\\(["']?([^"')]+)["']?\\)/gi, (m, val) => {
        try {
            const full = new URL(val, b).href;
            return 'url("${PREFIX}' + btoa(full) + '")';
        } catch(e) { return m; }
    });
}
            `;

            const blob = new Blob([swCode], { type: 'text/javascript' });
            const url = URL.createObjectURL(blob);

            navigator.serviceWorker.register(url, { scope: './' })
                .then(() => console.log('SW registered'))
                .catch(err => console.error('SW error', err));
        }
    </script>
</body>
</html>
