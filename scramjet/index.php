<?php
/**
 * MiniWebProxy - Works on broken cURL builds (like InfinityFree)
 * Manually handles gzip instead of relying on cURL encoding
 * Upload as proxy/index.php
 */

class MiniWebProxy {
    static $proxyUrl = '';

    static function run() {
        $url = isset($_GET['url']) ? $_GET['url'] : '';
        if (empty($url)) {
            self::showLanding();
            return;
        }
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            http_response_code(400);
            die('Invalid URL');
        }
        $parsed = parse_url($url);
        $host = isset($parsed['host']) ? $parsed['host'] : '';
        if (self::isPrivate($host)) {
            http_response_code(403);
            die('Access denied');
        }
        if (!function_exists('curl_init')) {
            http_response_code(500);
            die('cURL not enabled');
        }
        self::proxyRequest($url);
    }

    static function isPrivate($host) {
        $ip = gethostbyname($host);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return true;
        }
        $blocked = array('localhost', '127.0.0.1', '0.0.0.0', '::1');
        return in_array(strtolower($host), $blocked);
    }

    static function proxyRequest($url) {
        $ch = curl_init();
        $headers = array();
        $all = self::getHeaders();
        foreach ($all as $key => $val) {
            $kl = strtolower($key);
            if (in_array($kl, array('host', 'connection', 'content-length'))) continue;
            $headers[] = "$key: $val";
        }
        
        // Capture headers manually to check Content-Encoding
        $responseHeaders = array();
        $headerCallback = function($ch, $header) use (&$responseHeaders) {
            $responseHeaders[] = trim($header);
            return strlen($header);
        };
        
        curl_setopt_array($ch, array(
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_HEADERFUNCTION => $headerCallback,
            // NO CURLOPT_ENCODING - we handle it manually
        ));
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
        }
        $resp = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $ct = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $err = curl_error($ch);
        curl_close($ch);
        
        if ($resp === false) {
            http_response_code(502);
            die('Proxy error: ' . $err);
        }
        
        // Check if response is gzip encoded and decode manually
        $isGzip = false;
        foreach ($responseHeaders as $h) {
            if (stripos($h, 'Content-Encoding:') === 0) {
                $enc = strtolower(trim(substr($h, strlen('Content-Encoding:'))));
                if ($enc === 'gzip') {
                    $isGzip = true;
                }
            }
        }
        
        if ($isGzip && function_exists('gzdecode')) {
            $decoded = @gzdecode($resp);
            if ($decoded !== false) {
                $resp = $decoded;
            }
        }
        
        self::$proxyUrl = self::getProxyUrl();
        if ($ct && (strpos($ct, 'text/html') !== false || strpos($ct, 'application/xhtml') !== false)) {
            $resp = self::rewriteHtml($resp);
        } elseif ($ct && strpos($ct, 'text/css') !== false) {
            $resp = self::rewriteCss($resp);
        }
        http_response_code($code);
        if ($ct) header('Content-Type: ' . $ct);
        echo $resp;
    }

    static function cbHref($m) {
        return $m[1] . self::$proxyUrl . '?url=' . urlencode($m[2]) . $m[3];
    }
    static function cbSrc($m) {
        return $m[1] . self::$proxyUrl . '?url=' . urlencode($m[2]) . $m[3];
    }
    static function cbAction($m) {
        return $m[1] . self::$proxyUrl . '?url=' . urlencode($m[2]) . $m[3];
    }
    static function cbCss($m) {
        return 'url("' . self::$proxyUrl . '?url=' . urlencode($m[1]) . '")';
    }

    static function rewriteHtml($html) {
        $html = preg_replace_callback('/(href=["\'])(https?:\/\/[^"\']+)(["\'])/i', array('MiniWebProxy', 'cbHref'), $html);
        $html = preg_replace_callback('/(src=["\'])(https?:\/\/[^"\']+)(["\'])/i', array('MiniWebProxy', 'cbSrc'), $html);
        $html = preg_replace_callback('/(action=["\'])(https?:\/\/[^"\']+)(["\'])/i', array('MiniWebProxy', 'cbAction'), $html);

        $script = '<script>(function(){var p="' . self::$proxyUrl . '?url=";
        document.addEventListener("click",function(e){
            var a=e.target.closest("a");
            if(a&&a.href&&a.href.indexOf(p)!==0&&a.href.indexOf("javascript:")!==0&&a.href.match(/^https?:\/\//))
                a.href=p+encodeURIComponent(a.href);
        },true);
        var of=window.fetch;window.fetch=function(u,o){
            if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+encodeURIComponent(u);
            return of(u,o);
        };
        var oo=XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open=function(m,u,as,us,pw){
            if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+encodeURIComponent(u);
            return oo.call(this,m,u,as,us,pw);
        };
        })();</script>';

        if (stripos($html, '</body>') !== false) {
            $html = str_ireplace('</body>', $script . '</body>', $html);
        } else {
            $html .= $script;
        }
        return $html;
    }

    static function rewriteCss($css) {
        return preg_replace_callback('/url\(["\']?(https?:\/\/[^"\'\)]+)["\']?\)/i', array('MiniWebProxy', 'cbCss'), $css);
    }

    static function getProxyUrl() {
        $s = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
        return $s . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];
    }

    static function getHeaders() {
        if (function_exists('getallheaders')) return getallheaders();
        $h = array();
        foreach ($_SERVER as $n => $v) {
            if (substr($n, 0, 5) == 'HTTP_') {
                $h[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($n, 5)))))] = $v;
            }
        }
        return $h;
    }

    static function showLanding() {
        $host = $_SERVER['HTTP_HOST'];
        $script = $_SERVER['SCRIPT_NAME'];
        $dir = dirname($script);
        if ($dir == '/' || $dir == '\\') $dir = '';
        ?>
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MiniWebProxy</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:sans-serif;background:#0f0f23;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center}
.container{text-align:center;padding:2rem;max-width:600px;width:100%}
h1{font-size:2.5rem;margin-bottom:.5rem;background:linear-gradient(90deg,#ff6b6b,#feca57);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.subtitle{color:#888;margin-bottom:2rem}
.search-box{display:flex;gap:.5rem;margin-bottom:1.5rem}
input[type="url"]{flex:1;padding:1rem 1.5rem;border:2px solid #333;border-radius:12px;background:#1a1a2e;color:#fff;font-size:1rem;outline:none}
input[type="url"]:focus{border-color:#ff6b6b}
button{padding:1rem 2rem;border:none;border-radius:12px;background:linear-gradient(135deg,#ff6b6b,#feca57);color:#0f0f23;font-size:1rem;font-weight:600;cursor:pointer}
button:hover{transform:translateY(-2px);box-shadow:0 8px 25px rgba(255,107,107,.3)}
.info{background:#1a1a2e;border-radius:12px;padding:1.5rem;text-align:left;font-size:.9rem;color:#aaa;line-height:1.6}
.info code{background:#0f0f23;padding:.2rem .5rem;border-radius:4px;color:#feca57;font-family:monospace}
</style>
</head>
<body>
<div class="container">
<h1>MiniWebProxy</h1>
<p class="subtitle">Single-file PHP proxy</p>
<form action="" method="get" class="search-box">
<input type="url" name="url" placeholder="https://example.com" required autofocus>
<button type="submit">Go</button>
</form>
<div class="info">
<p><strong>Usage:</strong></p>
<p><code>https://<?php echo $host . $dir; ?>/?url=https://example.com</code></p>
</div>
</div>
</body>
</html>
        <?php
    }
}

MiniWebProxy::run();
