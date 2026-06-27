<?php
// =============================================
// Seamless Proxy - Scramjet-like Single File
// =============================================

$PREFIX = 'proxy/';

if (strpos($_SERVER['REQUEST_URI'], $PREFIX) === 0) {
    proxy_request();
    exit;
}

// ======================
// MAIN LANDING PAGE
// ======================
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Seamless Proxy</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 30px; background: #0d1117; color: #c9d1d9; }
        input, button { padding: 14px; font-size: 17px; }
        input { width: 75%; background: #161b22; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; }
        button { background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; }
        button:hover { background: #2ea44f; }
    </style>
</head>
<body>
    <h1>Seamless Proxy (Scramjet-style)</h1>
    <input type="text" id="url" placeholder="https://tiktok.com" value="https://">
    <button onclick="go()">Proxy Site</button>

    <script>
        const PREFIX = '<?= $PREFIX ?>';
        function go() {
            let input = document.getElementById('url').value.trim();
            if (!input.startsWith('http')) input = 'https://' + input;
            window.location.href = PREFIX + btoa(input);
        }
    </script>
</body>
</html>
<?php

// ======================
// PROXY CORE
// ======================
function proxy_request() {
    global $PREFIX;
    
    $encoded = substr($_SERVER['REQUEST_URI'], strlen($PREFIX));
    $encoded = strtok($encoded, '?');
    $targetUrl = base64_decode($encoded);

    if (!filter_var($targetUrl, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        die('Invalid URL');
    }

    $ch = curl_init($targetUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 10);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    curl_setopt($ch, CURLOPT_HTTPHEADER, get_forward_headers());
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_ENCODING, "");

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    if ($response === false) {
        http_response_code(502);
        die('Proxy Error: Failed to connect');
    }

    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);

    $contentType = get_header_value($headers, 'content-type');

    // Rewrite based on content type
    if (stripos($contentType, 'text/html') !== false || stripos($contentType, 'application/xhtml') !== false) {
        $body = rewrite_html($body, $targetUrl);
    } 
    elseif (stripos($contentType, 'text/css') !== false) {
        $body = rewrite_css($body, $targetUrl);
    } 
    elseif (stripos($contentType, 'javascript') !== false || stripos($contentType, 'application/json') !== false) {
        $body = rewrite_js($body, $targetUrl);
    }

    // Forward relevant headers
    forward_headers($headers);

    header("Content-Length: " . strlen($body));
    echo $body;
}

// ======================
// HELPERS
// ======================
function get_forward_headers() {
    $headers = [];
    $skip = ['host', 'content-length', 'accept-encoding'];
    foreach ($_SERVER as $key => $val) {
        if (strpos($key, 'HTTP_') === 0) {
            $name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))));
            if (!in_array(strtolower($name), $skip)) {
                $headers[] = "$name: $val";
            }
        }
    }
    return $headers;
}

function get_header_value($headerBlock, $name) {
    if (preg_match('/^' . preg_quote($name, '/') . ':\s*(.+?)$/im', $headerBlock, $m)) {
        return trim($m[1]);
    }
    return '';
}

function forward_headers($headerBlock) {
    $skip = ['content-length', 'transfer-encoding', 'content-encoding', 'set-cookie'];
    $lines = explode("\r\n", $headerBlock);
    foreach ($lines as $line) {
        if (strpos($line, ':') === false) continue;
        list($key, $value) = explode(':', $line, 2);
        $key = strtolower(trim($key));
        if (!in_array($key, $skip)) {
            header("$key: " . trim($value));
        }
    }
}

function make_proxy_url($url, $base) {
    global $PREFIX;
    if (empty($url) || $url[0] === '#' || strpos($url, 'data:') === 0 || strpos($url, 'javascript:') === 0) {
        return $url;
    }
    $full = (strpos($url, '//') === 0 ? 'https:' . $url : $url);
    if (!filter_var($full, FILTER_VALIDATE_URL)) {
        $full = rtrim($base, '/') . '/' . ltrim($url, '/');
    }
    return $PREFIX . base64_encode($full);
}

// ======================
// REWRITERS (Scramjet-style)
// ======================
function rewrite_html($html, $base) {
    $html = preg_replace_callback(
        '/\b(src|href|action|data|srcset|poster|formaction|data-src|data-href)=["\']([^"\']*)["\']/i',
        fn($m) => $m[1] . '="' . make_proxy_url($m[2], $base) . '"',
        $html
    );

    // srcset handling
    $html = preg_replace_callback(
        '/srcset=["\']([^"\']*)["\']/i',
        function($m) use ($base) {
            $parts = preg_split('/\s*,\s*/', $m[1]);
            $new = array_map(function($p) use ($base) {
                $p = trim($p);
                $space = strrpos($p, ' ');
                if ($space !== false) {
                    $url = substr($p, 0, $space);
                    $desc = substr($p, $space);
                    return make_proxy_url($url, $base) . $desc;
                }
                return make_proxy_url($p, $base);
            }, $parts);
            return 'srcset="' . implode(', ', $new) . '"';
        },
        $html
    );

    // CSS in style attributes and <style> tags
    $html = preg_replace_callback(
        '/style=["\']([^"\']*)["\']/i',
        fn($m) => 'style="' . rewrite_css($m[1], $base) . '"',
        $html
    );

    return $html;
}

function rewrite_css($css, $base) {
    // url() patterns
    $css = preg_replace_callback(
        '/url\(["\']?([^"\')]+)["\']?\)/i',
        fn($m) => 'url("' . make_proxy_url($m[1], $base) . '")',
        $css
    );

    // @import
    $css = preg_replace_callback(
        '/@import\s+["\']([^"\']+)["\']/i',
        fn($m) => '@import "' . make_proxy_url($m[1], $base) . '"',
        $css
    );

    return $css;
}

function rewrite_js($js, $base) {
    // Very aggressive but imperfect JS rewriting (best effort in single file)
    $patterns = [
        '/(["\'])(https?:\/\/[^"\']+)(["\'])/i' => fn($m) => $m[1] . make_proxy_url($m[2], $base) . $m[3],
        '/(["\'])(\/\/[^"\']+)(["\'])/i' => fn($m) => $m[1] . make_proxy_url('https:' . $m[2], $base) . $m[3],
        '/(location\s*[.=]\s*["\'])([^"\']+)(["\'])/i' => fn($m) => $m[1] . make_proxy_url($m[2], $base) . $m[3],
    ];

    foreach ($patterns as $regex => $callback) {
        $js = preg_replace_callback($regex, $callback, $js);
    }

    return $js;
}
