<?php
/**
 * Scramjet Proxy Configuration
 */

return [
    'codec' => 'base64',
    'codecs' => ['base64', 'rot13', 'xor'],
    'max_redirects' => 10,
    'timeout' => 30,
    'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'verify_ssl' => false,
    'blocked_domains' => ['localhost', '127.0.0.1', '0.0.0.0', '::1'],
    'enable_cookies' => true,
    'enable_compression' => true,
    'rewrite_html' => true,
    'rewrite_css' => true,
    'rewrite_js' => true,
    'rewrite_json' => true,
];
