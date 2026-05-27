<?php
/**
 * MiniWebProxy - A single-file PHP web proxy (PHP 5.6+ compatible)
 * Drop this file on any PHP host (like InfinityFree) and go.
 * 
 * Usage: https://yourdomain.com/proxy/?url=https://example.com
 */

// === CONFIG ===
$CONFIG = array(
    'timeout'       => 30,
    'max_redirects' => 5,
    'user_agent'    => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'blocked_hosts' => array(),
    'log_requests'  => false,
);

// === SECURITY: Block private/internal IPs ===
function is_private_ip($host) {
    $ip = gethostbyname($host);
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
        return true;
    }
    $private_hosts = array('localhost', '127.0.0.1', '0.0.0.0', '::1');
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
$host = isset($parsed['host']) ? $parsed['host'] : '';

// Check blocked hosts
if (is_private_ip($host) || in_array(strtolower($host), array_map('strtolower', $CONFIG['blocked_hosts']))) {
    http_response_code(403);
    die('Access denied');
}

// === FETCH CONTENT ===
if (!function_exists('curl_init')) {
    http_response_code(500);
    die('cURL is not enabled on this server. Contact your host.');
}

$ch = curl_init();

// Set all curl options
$headers = array();
$all_headers = getallheaders_compat();
foreach ($all_headers as $key => $value) {
    $key_lower = strtolower($key);
    if (in_array($key_lower, array('host', 'connection', 'content-length'))) continue;
    $headers[] = "$key: $value";
}

curl_setopt_array($ch, array(
    CURLOPT_URL            => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => $CONFIG['max_redirects'],
    CURLOPT_TIMEOUT        => $CONFIG['timeout'],
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_USERAGENT      => $CONFIG['user_agent'],
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_ENCODING       => 'gzip,deflate',
));

// Forward POST data
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

// Forward other methods
if (in_array($_SERVER['REQUEST_METHOD'], array('PUT', 'PATCH', 'DELETE'))) {
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
if ($content_type && (strpos($content_type, 'text/html') !== false || strpos($content_type, 'application/xhtml') !== false)) {
    $response = rewrite_html($response, $url, $effective_url);
} elseif ($content_type && strpos($content_type, 'text/css') !== false) {
    $response = rewrite_css($response, $url);
}

// === OUTPUT ===
http_response_code($http_code);
if ($content_type) {
    header('Content-Type: ' . $content_type);
}

echo $response;

// === FUNCTIONS ===

function show_landing_page() {
    $host = $_SERVER['HTTP_HOST'];
    $script = $_SERVER['SCRIPT_NAME'];
    $dir = dirname($script);
    if ($dir == '/' || $dir == '\\') $dir = '';
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
            <p><code>https://<?php echo $host . $dir; ?>/?url=https://example.com</code></p>
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
    
    // Rewrite absolute URLs in href attributes
    $html = preg_replace_callback(
        '/(href=["\'])(https?:\/\/[^"\']+)(["\'])/i',
        create_function('$m', '
            $proxy = "' . addslashes($proxy_url) . '";
            return $m[1] . $proxy . "?url=" . urlencode($m[2]) . $m[3];
        '),
        $html
    );
    
    // Rewrite absolute URLs in src attributes
    $html = preg_replace_callback(
        '/(src=["\'])(https?:\/\/[^"\']+)(["\'])/i',
        create_function('$m', '
            $proxy = "' . addslashes($proxy_url) . '";
            return $m[1] . $proxy . "?url=" . urlencode($m[2]) . $m[3];
        '),
        $html
    );
    
    // Rewrite absolute URLs in action attributes (forms)
    $html = preg_replace_callback(
        '/(action=["\'])(https?:\/\/[^"\']+)(["\'])/i',
        create_function('$m', '
            $proxy = "' . addslashes($proxy_url) . '";
            return $m[1] . $proxy . "?url=" . urlencode($m[2]) . $m[3];
        '),
        $html
    );
    
    // Rewrite relative URLs
    $html = rewrite_relative_urls($html, $base, $proxy_url);
    
    // Inject base tag
    $base_tag = '<base href="' . htmlspecialchars($base) . '">';
    if (stripos($html, '<head>') !== false) {
        $html = preg_replace('/(<head[^>]*>)/i', '$1' . $base_tag, $html, 1);
    }
    
    // Inject script to intercept dynamic navigation
    $inject_script = '<script>
(function() {
    var proxyBase = "' . $proxy_url . '?url=";
    
    document.addEventListener("click", function(e) {
        var el = e.target.closest("a");
        if (el && el.href && el.href.indexOf(proxyBase) !== 0 && el.href.indexOf("javascript:") !== 0) {
            if (el.href.match(/^https?:\/\//)) {
                el.href = proxyBase + encodeURIComponent(el.href);
            }
        }
    }, true);
    
    var origFetch = window.fetch;
    window.fetch = function(url, opts) {
        if (typeof url === "string" && url.match(/^https?:\/\//) && url.indexOf(proxyBase) !== 0) {
            url = proxyBase + encodeURIComponent(url);
        }
        return origFetch(url, opts);
    };
    
    var origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        if (typeof url === "string" && url.match(/^https?:\/\//) && url.indexOf(proxyBase) !== 0) {
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
    
    // Rewrite url() with absolute URLs
    $css = preg_replace_callback(
        '/url\(["\']?(https?:\/\/[^"\')\]+)["\']?\)/i',
        create_function('$m', '
            $proxy = "' . addslashes($proxy_url) . '";
            return "url(\"" . $proxy . "?url=" . urlencode($m[1]) . "\")";
        '),
        $css
    );
    
    return $css;
}

function rewrite_relative_urls($html, $base, $proxy_url) {
    // Rewrite relative hrefs starting with /
    $html = preg_replace_callback(
        '/(href=["\'])(\/[^"\']*)(["\'])/i',
        create_function('$m', '
            $proxy = "' . addslashes($proxy_url) . '";
            $base = "' . addslashes($base) . '";
            $abs = resolve_relative_url($m[2], $base);
            return $m[1] . $proxy . "?url=" . urlencode($abs) . $m[3];
        '),
        $html
    );
    
    // Rewrite relative srcs starting with /
    $html = preg_replace_callback(
        '/(src=["\'])(\/[^"\']*)(["\'])/i',
        create_function('$m', '
            $proxy = "' . addslashes($proxy_url) . '";
            $base = "' . addslashes($base) . '";
            $abs = resolve_relative_url($m[2], $base);
            return $m[1] . $proxy . "?url=" . urlencode($abs) . $m[3];
        '),
        $html
    );
    
    return $html;
}

function resolve_relative_url($rel, $base) {
    if (parse_url($rel, PHP_URL_SCHEME) != '') return $rel;
    if ($rel[0] == '#' || $rel[0] == '?') return $base . $rel;
    
    $base_parts = parse_url($base);
    $scheme = isset($base_parts['scheme']) ? $base_parts['scheme'] : 'https';
    $host = isset($base_parts['host']) ? $base_parts['host'] : '';
    $port = isset($base_parts['port']) ? ':' . $base_parts['port'] : '';
    $path = isset($base_parts['path']) ? $base_parts['path'] : '/';
    $path = preg_replace('#/[^/]*$#', '', $path);
    
    if ($rel[0] == '/') $path = '';
    
    $abs = $host . $port . $path . '/' . $rel;
    
    $re = array('#(/\.?/)#', '#/(?!\.\.)[^/]+/\.\./#');
    for ($n = 1; $n > 0; $abs = preg_replace($re, '/', $abs, -1, $n)) {}
    
    return $scheme . '://' . $abs;
}

function get_base_url($url) {
    $parsed = parse_url($url);
    $scheme = isset($parsed['scheme']) ? $parsed['scheme'] : 'https';
    $host = isset($parsed['host']) ? $parsed['host'] : '';
    $port = isset($parsed['port']) ? ':' . $parsed['port'] : '';
    $path = isset($parsed['path']) ? $parsed['path'] : '/';
    $base = $scheme . '://' . $host . $port . $path;
    $base = preg_replace('#/[^/]*$#', '/', $base);
    return $base;
}

function get_proxy_url() {
    $scheme = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    return $scheme . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];
}

function getallheaders_compat() {
    if (function_exists('getallheaders')) {
        return getallheaders();
    }
    $headers = array();
    foreach ($_SERVER as $name => $value) {
        if (substr($name, 0, 5) == 'HTTP_') {
            $header_name = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
            $headers[$header_name] = $value;
        }
    }
    return $headers;
}
