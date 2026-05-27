<?php
/**
 * MiniWebProxy - A single-file PHP web proxy
 * Drop this file on any PHP host (like InfinityFree) and go.
 * 
 * Usage: https://yourdomain.com/proxy.php?url=https://example.com
 */

// === CONFIG ===
$CONFIG = [
    'timeout'       => 30,      // Request timeout in seconds
    'max_redirects' => 5,       // Max HTTP redirects to follow
    'user_agent'    => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'blocked_hosts' => [],      // Domains to block (e.g. ['localhost', '127.0.0.1'])
    'log_requests'  => false,   // Set to true to log requests
];

// === SECURITY: Block private/internal IPs ===
function is_private_ip($host) {
    $ip = gethostbyname($host);
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        return true;
    }
    $private_hosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    return in_array(strtolower($host), $private_hosts);
}

// === GET TARGET URL ===
$url = isset($_GET['url']) ? $_GET['url'] : '';

// Show landing page if no URL provided
if (empty($url)) {
    show_landing_page();
    exit;
}

// Validate URL
if (!filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    die('Invalid URL');
}

$parsed = parse_url($url);
$host = $parsed['host'] ?? '';

// Check blocked hosts
if (is_private_ip($host) || in_array(strtolower($host), array_map('strtolower', $CONFIG['blocked_hosts']))) {
    http_response_code(403);
    die('Access denied');
}

// === FETCH CONTENT ===
$ch = curl_init();

// Set all curl options
$headers = [];
foreach (getallheaders() as $key => $value) {
    $key_lower = strtolower($key);
    // Skip headers we don't want to forward
    if (in_array($key_lower, ['host', 'connection', 'content-length'])) continue;
    $headers[] = "$key: $value";
}

curl_setopt_array($ch, [
    CURLOPT_URL            => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => $CONFIG['max_redirects'],
    CURLOPT_TIMEOUT        => $CONFIG['timeout'],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_USERAGENT      => $CONFIG['user_agent'],
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_ENCODING       => '', // Accept all encodings
]);

// Forward POST data
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

// Forward other methods
if (in_array($_SERVER['REQUEST_METHOD'], ['PUT', 'PATCH', 'DELETE'])) {
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $_SERVER['REQUEST_METHOD']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$content_type = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$effective_url = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) {
    http_response_code(502);
    die('Proxy error: ' . $error);
}

// === REWRITE RESPONSE ===
// Only rewrite HTML content
if ($content_type && (strpos($content_type, 'text/html') !== false || strpos($content_type, 'application/xhtml') !== false)) {
    $response = rewrite_html($response, $url, $effective_url);
} elseif ($content_type && (strpos($content_type, 'text/css') !== false)) {
    $response = rewrite_css($response, $url);
} elseif ($content_type && (strpos($content_type, 'javascript') !== false || strpos($content_type, '/json') !== false)) {
    $response = rewrite_js($response, $url);
}

// === OUTPUT ===
http_response_code($http_code);
if ($content_type) {
    header('Content-Type: ' . $content_type);
}
// Forward other important headers
$forward_headers = ['set-cookie', 'cache-control', 'expires', 'last-modified', 'etag'];
foreach ($forward_headers as $h) {
    // Note: curl doesn't give us response headers easily without CURLOPT_HEADER
}

echo $response;

// === FUNCTIONS ===

function show_landing_page() {
    $host = $_SERVER['HTTP_HOST'];
    $script = $_SERVER['SCRIPT_NAME'];
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MiniWebProxy</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f23;
            color: #e0e0e0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
            width: 100%;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 0.5rem;
            background: linear-gradient(90deg, #ff6b6b, #feca57);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .subtitle {
            color: #888;
            margin-bottom: 2rem;
        }
        .search-box {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
        }
        input[type="url"] {
            flex: 1;
            padding: 1rem 1.5rem;
            border: 2px solid #333;
            border-radius: 12px;
            background: #1a1a2e;
            color: #fff;
            font-size: 1rem;
            outline: none;
            transition: border-color 0.3s;
        }
        input[type="url"]:focus {
            border-color: #ff6b6b;
        }
        button {
            padding: 1rem 2rem;
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, #ff6b6b, #feca57);
            color: #0f0f23;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3);
        }
        .info {
            background: #1a1a2e;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: left;
            font-size: 0.9rem;
            color: #aaa;
            line-height: 1.6;
        }
        .info code {
            background: #0f0f23;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            color: #feca57;
            font-family: 'Courier New', monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>MiniWebProxy</h1>
        <p class="subtitle">Single-file PHP proxy for InfinityFree & beyond</p>

        <form action="" method="get" class="search-box">
            <input type="url" name="url" placeholder="https://example.com" required autofocus>
            <button type="submit">Go</button>
        </form>

        <div class="info">
            <p><strong>Usage:</strong> Enter any URL above, or directly visit:</p>
            <p><code>https://<?php echo $host . $script; ?>?url=https://example.com</code></p>
            <br>
            <p><strong>Tips:</strong></p>
            <p>• Works on any PHP host (InfinityFree, 000webhost, etc.)</p>
            <p>• No database or dependencies needed</p>
            <p>• Just upload this one file and you're set</p>
        </div>
    </div>
</body>
</html>
    <?php
}

function rewrite_html($html, $base_url, $effective_url) {
    $proxy_url = get_proxy_url();
    $base = get_base_url($effective_url);

    // Rewrite absolute URLs in attributes
    $patterns = [
        // href attributes
        '/(href=["\'])(https?:\/\/[^"\']+)(["\'])/i' => function($m) use ($proxy_url) {
            return $m[1] . $proxy_url . '?url=' . urlencode($m[2]) . $m[3];
        },
        // src attributes  
        '/(src=["\'])(https?:\/\/[^"\']+)(["\'])/i' => function($m) use ($proxy_url) {
            return $m[1] . $proxy_url . '?url=' . urlencode($m[2]) . $m[3];
        },
        // action attributes (forms)
        '/(action=["\'])(https?:\/\/[^"\']+)(["\'])/i' => function($m) use ($proxy_url) {
            return $m[1] . $proxy_url . '?url=' . urlencode($m[2]) . $m[3];
        },
        // content attribute (meta refresh)
        '/(content=["\']\d+;url=)(https?:\/\/[^"\']+)(["\'])/i' => function($m) use ($proxy_url) {
            return $m[1] . $proxy_url . '?url=' . urlencode($m[2]) . $m[3];
        },
    ];

    foreach ($patterns as $pattern => $callback) {
        $html = preg_replace_callback($pattern, $callback, $html);
    }

    // Rewrite relative URLs
    $html = rewrite_relative_urls($html, $base, $proxy_url);

    // Inject base tag to help with relative URLs
    $base_tag = '<base href="' . htmlspecialchars($base) . '">';
    if (stripos($html, '<head>') !== false) {
        $html = preg_replace('/(<head[^>]*>)/i', '$1' . $base_tag, $html, 1);
    }

    // Inject script to handle dynamic links
    $inject_script = '
<script>
(function() {
    const proxyBase = "' . $proxy_url . '?url=";

    // Intercept all link clicks
    document.addEventListener("click", function(e) {
        const el = e.target.closest("a");
        if (el && el.href && !el.href.startsWith(proxyBase) && !el.href.startsWith("javascript:")) {
            if (el.href.match(/^https?:\/\//)) {
                el.href = proxyBase + encodeURIComponent(el.href);
            }
        }
    }, true);

    // Rewrite fetch/XMLHttpRequest
    const origFetch = window.fetch;
    window.fetch = function(url, opts) {
        if (typeof url === "string" && url.match(/^https?:\/\//) && !url.startsWith(proxyBase)) {
            url = proxyBase + encodeURIComponent(url);
        }
        return origFetch(url, opts);
    };

    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (typeof url === "string" && url.match(/^https?:\/\//) && !url.startsWith(proxyBase)) {
            url = proxyBase + encodeURIComponent(url);
        }
        return origOpen.call(this, method, url, async, user, password);
    };
})();
</script>';

    if (stripos($html, '</body>') !== false) {
        $html = str_ireplace('</body>', $inject_script . '</body>', $html);
    } else {
        $html .= $inject_script;
    }

    return $html;
}

function rewrite_css($css, $base_url) {
    $proxy_url = get_proxy_url();
    $base = get_base_url($base_url);

    // Rewrite url() in CSS
    $css = preg_replace_callback(
        '/url\(["\']?(https?:\/\/[^"\'\)]+)["\']?\)/i',
        function($m) use ($proxy_url) {
            return 'url("' . $proxy_url . '?url=' . urlencode($m[1]) . '")';
        },
        $css
    );

    // Rewrite relative URLs in CSS
    $css = preg_replace_callback(
        '/url\(["\']?([^"\'\)\/][^"\'\)]*)["\']?\)/i',
        function($m) use ($base, $proxy_url) {
            $abs = resolve_relative_url($m[1], $base);
            return 'url("' . $proxy_url . '?url=' . urlencode($abs) . '")';
        },
        $css
    );

    return $css;
}

function rewrite_js($js, $base_url) {
    $proxy_url = get_proxy_url();
    // Basic JS rewriting - this is limited
    // Full JS rewriting requires AST parsing which is complex
    return $js;
}

function rewrite_relative_urls($html, $base, $proxy_url) {
    // Rewrite relative URLs (starting with / or ./ or ../)
    $html = preg_replace_callback(
        '/(href=["\'])(\/[^"\']*)(["\'])/i',
        function($m) use ($base, $proxy_url) {
            $abs = resolve_relative_url($m[2], $base);
            return $m[1] . $proxy_url . '?url=' . urlencode($abs) . $m[3];
        },
        $html
    );

    $html = preg_replace_callback(
        '/(src=["\'])(\/[^"\']*)(["\'])/i',
        function($m) use ($base, $proxy_url) {
            $abs = resolve_relative_url($m[2], $base);
            return $m[1] . $proxy_url . '?url=' . urlencode($abs) . $m[3];
        },
        $html
    );

    return $html;
}

function resolve_relative_url($rel, $base) {
    if (parse_url($rel, PHP_URL_SCHEME) != '') return $rel;
    if ($rel[0] == '#' || $rel[0] == '?') return $base . $rel;

    extract(parse_url($base));
    $path = preg_replace('#/[^/]*$#', '', $path ?? '/');

    if ($rel[0] == '/') $path = '';

    $abs = ($user ?? '') . (isset($pass) ? ":$pass" : '') . ($user ? '@' : '');
    $abs .= $host . (isset($port) ? ":$port" : '');
    $abs .= $path . '/' . $rel;

    $re = ['#(/\.?/)#', '#/(?!\.\.)[^/]+/\.\./#'];
    for ($n = 1; $n > 0; $abs = preg_replace($re, '/', $abs, -1, $n)) {}

    return $scheme . '://' . $abs;
}

function get_base_url($url) {
    $parsed = parse_url($url);
    $base = $parsed['scheme'] . '://' . $parsed['host'];
    if (isset($parsed['port'])) $base .= ':' . $parsed['port'];
    $base .= ($parsed['path'] ?? '/');
    $base = preg_replace('#/[^/]*$#', '/', $base);
    return $base;
}

function get_proxy_url() {
    $scheme = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    return $scheme . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];
}

// Polyfill for getallheaders() if not available (e.g., on some servers)
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}
