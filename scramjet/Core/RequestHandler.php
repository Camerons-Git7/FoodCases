<?php
/**
 * Request Handler
 */

namespace Scramjet\Core;

use Scramjet\Codec\CodecManager;
use Scramjet\Core\CookieManager;

class RequestHandler {
    private $config;
    private $codecManager;
    private $cookieManager;

    public function __construct(array $config, CodecManager $codecManager, CookieManager $cookieManager) {
        $this->config = $config;
        $this->codecManager = $codecManager;
        $this->cookieManager = $cookieManager;
    }

    public function handleRequest(string $url): array {
        $ch = curl_init();
        $headers = $this->buildHeaders($url);
        
        $responseHeaders = [];
        $headerCallback = function($ch, $header) use (&$responseHeaders) {
            $responseHeaders[] = trim($header);
            return strlen($header);
        };
        
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => $this->config['max_redirects'],
            CURLOPT_TIMEOUT => $this->config['timeout'],
            CURLOPT_SSL_VERIFYPEER => $this->config['verify_ssl'],
            CURLOPT_SSL_VERIFYHOST => $this->config['verify_ssl'] ? 2 : 0,
            CURLOPT_USERAGENT => $this->config['user_agent'],
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_HEADERFUNCTION => $headerCallback,
            CURLOPT_ENCODING => $this->config['enable_compression'] ? 'gzip,deflate,br' : '',
        ]);
        
        $method = $_SERVER['REQUEST_METHOD'];
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        
        if (in_array($method, ['POST', 'PUT', 'PATCH'])) {
            $body = file_get_contents('php://input');
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }
        
        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($response === false) {
            throw new \Exception("Proxy error: $error");
        }
        
        // Process cookies
        if ($this->config['enable_cookies']) {
            $this->cookieManager->processResponseCookies($responseHeaders, $url);
        }
        
        return [
            'body' => $response,
            'status' => $statusCode,
            'content_type' => $contentType,
            'headers' => $responseHeaders,
        ];
    }

    private function buildHeaders(string $url): array {
        $headers = [];
        $allHeaders = $this->getRequestHeaders();
        
        // Add cookie header
        if ($this->config['enable_cookies']) {
            $cookieHeader = $this->cookieManager->getCookieHeader($url);
            if ($cookieHeader) {
                $headers[] = $cookieHeader;
            }
        }
        
        // Forward other headers
        foreach ($allHeaders as $key => $value) {
            $keyLower = strtolower($key);
            if (in_array($keyLower, ['host', 'connection', 'content-length', 'cookie'])) {
                continue;
            }
            $headers[] = "$key: $value";
        }
        
        return $headers;
    }

    private function getRequestHeaders(): array {
        if (function_exists('getallheaders')) {
            return getallheaders();
        }
        
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) === 'HTTP_') {
                $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                $headers[$headerName] = $value;
            }
        }
        return $headers;
    }
}
