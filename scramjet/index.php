<?php
/**
 * Scramjet-like PHP Proxy
 * Advanced interception-based web proxy with URL encoding, JavaScript injection, and cookie management
 */

class ScramjetProxy {
    static $proxyUrl = '';
    static $cookieJar = [];
    static $codec = 'base64';

    static function run() {
        self::$proxyUrl = self::getProxyUrl();
        
        // Handle different request formats
        if (isset($_GET['url'])) {
            $url = $_GET['url'];
        } elseif (isset($_GET['q'])) {
            $url = self::decodeUrl($_GET['q']);
        } else {
            self::showLanding();
            return;
        }
        
        if (empty($url)) {
            self::showLanding();
            return;
        }
        
        // Decode URL if using codec
        if (self::isEncoded($url)) {
            $url = self::decodeUrl($url);
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

    static function isEncoded($url) {
        return strpos($url, 'http') !== 0;
    }

    static function encodeUrl($url) {
        switch (self::$codec) {
            case 'base64':
                return rtrim(strtr(base64_encode($url), '+/', '-_'), '=');
            case 'rot13':
                return str_rot13($url);
            default:
                return urlencode($url);
        }
    }

    static function decodeUrl($encoded) {
        switch (self::$codec) {
            case 'base64':
                return base64_decode(strtr(str_pad($encoded, strlen($encoded) + (4 - strlen($encoded) % 4) % 4, '='), '-_', '+/'));
            case 'rot13':
                return str_rot13($encoded);
            default:
                return urldecode($encoded);
        }
    }

    static function proxyRequest($url) {
        $ch = curl_init();
        $headers = array();
        $all = self::getHeaders();
        
        // Handle cookies
        $cookieHeader = self::getCookieHeader($url);
        if ($cookieHeader) {
            $headers[] = $cookieHeader;
        }
        
        foreach ($all as $key => $val) {
            $kl = strtolower($key);
            if (in_array($kl, array('host', 'connection', 'content-length', 'cookie'))) continue;
            $headers[] = "$key: $val";
        }
        
        // Capture headers manually to check Content-Encoding and Set-Cookie
        $responseHeaders = array();
        $headerCallback = function($ch, $header) use (&$responseHeaders) {
            $responseHeaders[] = trim($header);
            return strlen($header);
        };
        
        curl_setopt_array($ch, array(
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 10,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_HEADERFUNCTION => $headerCallback,
            CURLOPT_ENCODING => 'gzip,deflate',
        ));
        
        // Handle all HTTP methods
        $method = $_SERVER['REQUEST_METHOD'];
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        
        if ($method === 'POST' || $method === 'PUT' || $method === 'PATCH') {
            $body = file_get_contents('php://input');
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
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
        
        // Process response headers for cookies
        self::processResponseCookies($responseHeaders, $url);
        
        // Check if response is gzip encoded and decode manually
        $isGzip = false;
        foreach ($responseHeaders as $h) {
            if (stripos($h, 'Content-Encoding:') === 0) {
                $enc = strtolower(trim(substr($h, strlen('Content-Encoding:'))));
                if ($enc === 'gzip' || $enc === 'deflate') {
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
        
        // Rewrite content based on type
        if ($ct && (strpos($ct, 'text/html') !== false || strpos($ct, 'application/xhtml') !== false)) {
            $resp = self::rewriteHtml($resp);
        } elseif ($ct && strpos($ct, 'text/css') !== false) {
            $resp = self::rewriteCss($resp);
        } elseif ($ct && strpos($ct, 'application/javascript') !== false || strpos($ct, 'text/javascript') !== false) {
            $resp = self::rewriteJs($resp);
        } elseif ($ct && strpos($ct, 'application/json') !== false) {
            $resp = self::rewriteJson($resp);
        }
        
        http_response_code($code);
        if ($ct) header('Content-Type: ' . $ct);
        
        // Forward important response headers
        foreach ($responseHeaders as $h) {
            if (stripos($h, 'Content-Type:') === 0 || stripos($h, 'Content-Disposition:') === 0) {
                header($h);
            }
        }
        
        echo $resp;
    }

    static function getCookieHeader($url) {
        $parsed = parse_url($url);
        $host = isset($parsed['host']) ? $parsed['host'] : '';
        $cookies = array();
        
        foreach (self::$cookieJar as $domain => $domainCookies) {
            if (self::domainMatch($host, $domain)) {
                foreach ($domainCookies as $name => $cookie) {
                    if ($cookie['secure'] && parse_url($url, PHP_URL_SCHEME) !== 'https') continue;
                    if ($cookie['path'] && strpos(parse_url($url, PHP_URL_PATH) ?: '/', $cookie['path']) !== 0) continue;
                    if ($cookie['expires'] && time() > $cookie['expires']) continue;
                    $cookies[] = $name . '=' . $cookie['value'];
                }
            }
        }
        
        return !empty($cookies) ? 'Cookie: ' . implode('; ', $cookies) : '';
    }

    static function processResponseCookies($headers, $url) {
        $parsed = parse_url($url);
        $host = isset($parsed['host']) ? $parsed['host'] : '';
        $path = isset($parsed['path']) ? $parsed['path'] : '/';
        $secure = parse_url($url, PHP_URL_SCHEME) === 'https';
        
        foreach ($headers as $h) {
            if (stripos($h, 'Set-Cookie:') === 0) {
                $cookieStr = trim(substr($h, strlen('Set-Cookie:')));
                $parts = explode(';', $cookieStr);
                $nameValue = explode('=', trim($parts[0]), 2);
                if (count($nameValue) < 2) continue;
                
                $name = trim($nameValue[0]);
                $value = trim($nameValue[1]);
                
                $cookie = array(
                    'value' => $value,
                    'path' => $path,
                    'secure' => $secure,
                    'expires' => null
                );
                
                for ($i = 1; $i < count($parts); $i++) {
                    $part = trim($parts[$i]);
                    if (stripos($part, 'Expires=') === 0) {
                        $cookie['expires'] = strtotime(substr($part, 8));
                    } elseif (stripos($part, 'Path=') === 0) {
                        $cookie['path'] = trim(substr($part, 5));
                    } elseif (strtolower($part) === 'Secure') {
                        $cookie['secure'] = true;
                    }
                }
                
                if (!isset(self::$cookieJar[$host])) {
                    self::$cookieJar[$host] = array();
                }
                self::$cookieJar[$host][$name] = $cookie;
            }
        }
    }

    static function domainMatch($host, $cookieDomain) {
        if ($host === $cookieDomain) return true;
        if (strpos($cookieDomain, '.') === 0) {
            return substr($host, -strlen($cookieDomain)) === $cookieDomain;
        }
        return false;
    }

    static function cbHref($m) {
        return $m[1] . self::$proxyUrl . '?q=' . self::encodeUrl($m[2]) . $m[3];
    }
    static function cbSrc($m) {
        return $m[1] . self::$proxyUrl . '?q=' . self::encodeUrl($m[2]) . $m[3];
    }
    static function cbAction($m) {
        return $m[1] . self::$proxyUrl . '?q=' . self::encodeUrl($m[2]) . $m[3];
    }
    static function cbCss($m) {
        return 'url("' . self::$proxyUrl . '?q=' . self::encodeUrl($m[1]) . '")';
    }

    static function rewriteHtml($html) {
        $html = preg_replace_callback('/(href=["\'])(https?:\/\/[^"\']+)(["\'])/i', array('ScramjetProxy', 'cbHref'), $html);
        $html = preg_replace_callback('/(src=["\'])(https?:\/\/[^"\']+)(["\'])/i', array('ScramjetProxy', 'cbSrc'), $html);
        $html = preg_replace_callback('/(action=["\'])(https?:\/\/[^"\']+)(["\'])/i', array('ScramjetProxy', 'cbAction'), $html);
        $html = preg_replace_callback('/(content=["\'])(https?:\/\/[^"\']+)(["\'])/i', array('ScramjetProxy', 'cbSrc'), $html);

        $script = '<script>(function(){
            var p="' . self::$proxyUrl . '?q=";
            var enc=function(u){return btoa(u).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")};
            var dec=function(s){return atob(s.replace(/-/g,"+").replace(/_/g,"/"))};
            
            document.addEventListener("click",function(e){
                var a=e.target.closest("a");
                if(a&&a.href&&a.href.indexOf(p)!==0&&a.href.indexOf("javascript:")!==0&&a.href.indexOf("#")!==0&&a.href.match(/^https?:\/\//))
                    a.href=p+enc(a.href);
            },true);
            
            var of=window.fetch;
            window.fetch=function(u,o){
                if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                return of(u,o);
            };
            
            var oo=XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open=function(m,u,as,us,pw){
                if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                return oo.call(this,m,u,as,us,pw);
            };
            
            var ow=window.open;
            window.open=function(u,n,f){
                if(typeof u==="string"&&u.match(/^https?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                return ow(u,n,f);
            };
            
            if(window.WebSocket){
                var owc=window.WebSocket;
                window.WebSocket=function(u,p){
                    if(typeof u==="string"&&u.match(/^wss?:\/\//)&&u.indexOf(p)!==0)u=p+enc(u);
                    return owc(u,p);
                };
            }
        })();</script>';

        if (stripos($html, '</body>') !== false) {
            $html = str_ireplace('</body>', $script . '</body>', $html);
        } else {
            $html .= $script;
        }
        return $html;
    }

    static function rewriteCss($css) {
        return preg_replace_callback('/url\(["\']?(https?:\/\/[^"\'\)]+)["\']?\)/i', array('ScramjetProxy', 'cbCss'), $css);
    }

    static function rewriteJs($js) {
        // Rewrite URLs in JavaScript strings
        $js = preg_replace_callback('/(["\'])(https?:\/\/[^"\']+)\1/i', array('ScramjetProxy', 'cbJsString'), $js);
        return $js;
    }

    static function rewriteJson($json) {
        // Rewrite URLs in JSON
        $json = preg_replace_callback('/"(https?:\/\/[^"]+)"/', array('ScramjetProxy', 'cbJsonString'), $json);
        return $json;
    }

    static function cbJsString($m) {
        return $m[1] . self::$proxyUrl . '?q=' . self::encodeUrl($m[2]) . $m[1];
    }

    static function cbJsonString($m) {
        return '"' . self::$proxyUrl . '?q=' . self::encodeUrl($m[1]) . '"';
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
<title>Scramjet Proxy</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0a0a0f;color:#e0e0e0;min-height:100vh;display:flex;align-items:center;justify-content:center;background-image:radial-gradient(circle at 20% 50%,rgba(120,0,255,.1) 0%,transparent 50%),radial-gradient(circle at 80% 80%,rgba(255,0,100,.1) 0%,transparent 50%)}
.container{text-align:center;padding:3rem;max-width:700px;width:100%}
.logo{font-size:3.5rem;font-weight:800;margin-bottom:1rem;background:linear-gradient(135deg,#00f0ff,#7000ff,#ff0060);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:-2px}
.subtitle{color:#666;margin-bottom:3rem;font-size:1.1rem;font-weight:500}
.search-box{display:flex;gap:1rem;margin-bottom:2.5rem}
input[type="url"]{flex:1;padding:1.2rem 2rem;border:2px solid #222;border-radius:16px;background:#111;color:#fff;font-size:1.1rem;outline:none;transition:all .3s}
input[type="url"]:focus{border-color:#7000ff;box-shadow:0 0 30px rgba(112,0,255,.2)}
button{padding:1.2rem 3rem;border:none;border-radius:16px;background:linear-gradient(135deg,#7000ff,#ff0060);color:#fff;font-size:1.1rem;font-weight:700;cursor:pointer;transition:all .3s}
button:hover{transform:translateY(-3px);box-shadow:0 10px 40px rgba(112,0,255,.4)}
.features{display:grid;grid-template-columns:repeat(3,1fr);gap:1.5rem;margin-top:3rem}
.feature{background:#111;border:1px solid #222;border-radius:12px;padding:1.5rem;text-align:center;transition:all .3s}
.feature:hover{border-color:#7000ff;transform:translateY(-5px)}
.feature-icon{font-size:2rem;margin-bottom:.8rem}
.feature-title{color:#fff;font-weight:600;margin-bottom:.5rem;font-size:.95rem}
.feature-desc{color:#666;font-size:.85rem;line-height:1.5}
.info{background:#111;border:1px solid #222;border-radius:12px;padding:1.5rem;text-align:left;font-size:.9rem;color:#888;line-height:1.6;margin-top:2rem}
.info code{background:#0a0a0f;padding:.3rem .6rem;border-radius:6px;color:#00f0ff;font-family:'Consolas',monospace;font-size:.85rem}
@media(max-width:600px){.features{grid-template-columns:1fr}.search-box{flex-direction:column}}
</style>
</head>
<body>
<div class="container">
<div class="logo">Scramjet</div>
<p class="subtitle">Advanced Interception-Based Web Proxy</p>
<form action="" method="get" class="search-box">
<input type="url" name="url" placeholder="Enter URL to browse..." required autofocus>
<button type="submit">Browse</button>
</form>
<div class="features">
<div class="feature">
<div class="feature-icon">🚀</div>
<div class="feature-title">Fast & Secure</div>
<div class="feature-desc">Advanced URL encoding with multiple codec options</div>
</div>
<div class="feature">
<div class="feature-icon">🔒</div>
<div class="feature-title">Privacy First</div>
<div class="feature-desc">Full cookie management and session handling</div>
</div>
<div class="feature">
<div class="feature-icon">⚡</div>
<div class="feature-title">JavaScript Interception</div>
<div class="feature-desc">Comprehensive fetch/XHR/WebSocket rewriting</div>
</div>
</div>
<div class="info">
<p><strong>Quick Start:</strong></p>
<p><code>https://<?php echo $host . $dir; ?>/?url=https://example.com</code></p>
<p style="margin-top:.8rem;color:#666;font-size:.85rem">Or use encoded format: <code>?q=<base64_encoded_url></code></p>
</div>
</div>
</body>
</html>
        <?php
    }
}

ScramjetProxy::run();
