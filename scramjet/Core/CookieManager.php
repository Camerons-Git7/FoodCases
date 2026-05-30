<?php
/**
 * Cookie Manager
 */

namespace Scramjet\Core;

class CookieManager {
    private $cookieJar = [];

    public function getCookieHeader(string $url): ?string {
        $parsed = parse_url($url);
        $host = $parsed['host'] ?? '';
        $path = $parsed['path'] ?? '/';
        $secure = ($parsed['scheme'] ?? 'http') === 'https';
        
        $cookies = [];
        
        foreach ($this->cookieJar as $domain => $domainCookies) {
            if ($this->domainMatch($host, $domain)) {
                foreach ($domainCookies as $name => $cookie) {
                    if ($cookie['secure'] && !$secure) continue;
                    if ($cookie['path'] && strpos($path, $cookie['path']) !== 0) continue;
                    if ($cookie['expires'] && time() > $cookie['expires']) continue;
                    $cookies[] = $name . '=' . $cookie['value'];
                }
            }
        }
        
        return !empty($cookies) ? 'Cookie: ' . implode('; ', $cookies) : null;
    }

    public function processResponseCookies(array $headers, string $url): void {
        $parsed = parse_url($url);
        $host = $parsed['host'] ?? '';
        $path = $parsed['path'] ?? '/';
        $secure = ($parsed['scheme'] ?? 'http') === 'https';
        
        foreach ($headers as $header) {
            if (stripos($header, 'Set-Cookie:') === 0) {
                $cookieStr = trim(substr($header, strlen('Set-Cookie:')));
                $parts = explode(';', $cookieStr);
                $nameValue = explode('=', trim($parts[0]), 2);
                
                if (count($nameValue) < 2) continue;
                
                $name = trim($nameValue[0]);
                $value = trim($nameValue[1]);
                
                $cookie = [
                    'value' => $value,
                    'path' => $path,
                    'secure' => $secure,
                    'expires' => null,
                    'httponly' => false,
                ];
                
                for ($i = 1; $i < count($parts); $i++) {
                    $part = trim($parts[$i]);
                    if (stripos($part, 'Expires=') === 0) {
                        $cookie['expires'] = strtotime(substr($part, 8));
                    } elseif (stripos($part, 'Path=') === 0) {
                        $cookie['path'] = trim(substr($part, 5));
                    } elseif (stripos($part, 'Domain=') === 0) {
                        $host = trim(substr($part, 7));
                    } elseif (strtolower($part) === 'Secure') {
                        $cookie['secure'] = true;
                    } elseif (strtolower($part) === 'HttpOnly') {
                        $cookie['httponly'] = true;
                    }
                }
                
                if (!isset($this->cookieJar[$host])) {
                    $this->cookieJar[$host] = [];
                }
                $this->cookieJar[$host][$name] = $cookie;
            }
        }
    }

    private function domainMatch(string $host, string $cookieDomain): bool {
        if ($host === $cookieDomain) return true;
        if (strpos($cookieDomain, '.') === 0) {
            return substr($host, -strlen($cookieDomain)) === $cookieDomain;
        }
        return false;
    }

    public function clearCookies(): void {
        $this->cookieJar = [];
    }

    public function getCookieJar(): array {
        return $this->cookieJar;
    }
}
