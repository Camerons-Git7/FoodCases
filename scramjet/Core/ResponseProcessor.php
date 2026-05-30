<?php
/**
 * Response Processor
 */

namespace Scramjet\Core;

use Scramjet\Rewriter\HtmlRewriter;
use Scramjet\Rewriter\CssRewriter;
use Scramjet\Rewriter\JsRewriter;
use Scramjet\Rewriter\JsonRewriter;
use Scramjet\Injection\InterceptorScript;

class ResponseProcessor {
    private $config;
    private $codecManager;
    private $proxyUrl;
    private $htmlRewriter;
    private $cssRewriter;
    private $jsRewriter;
    private $jsonRewriter;
    private $interceptorScript;

    public function __construct(array $config, $codecManager, string $proxyUrl) {
        $this->config = $config;
        $this->codecManager = $codecManager;
        $this->proxyUrl = $proxyUrl;
        
        $this->htmlRewriter = new HtmlRewriter($proxyUrl, $codecManager);
        $this->cssRewriter = new CssRewriter($proxyUrl, $codecManager);
        $this->jsRewriter = new JsRewriter($proxyUrl, $codecManager);
        $this->jsonRewriter = new JsonRewriter($proxyUrl, $codecManager);
        $this->interceptorScript = new InterceptorScript($proxyUrl, $codecManager);
    }

    public function processResponse(array $response): array {
        $body = $response['body'];
        $contentType = $response['content_type'];
        
        // Decompress if needed
        $body = $this->decompressBody($body, $response['headers']);
        
        // Rewrite based on content type
        if ($contentType) {
            if (stripos($contentType, 'text/html') !== false || stripos($contentType, 'application/xhtml') !== false) {
                if ($this->config['rewrite_html']) {
                    $body = $this->htmlRewriter->rewrite($body);
                    $body = $this->interceptorScript->inject($body);
                }
            } elseif (stripos($contentType, 'text/css') !== false) {
                if ($this->config['rewrite_css']) {
                    $body = $this->cssRewriter->rewrite($body);
                }
            } elseif (stripos($contentType, 'application/javascript') !== false || stripos($contentType, 'text/javascript') !== false) {
                if ($this->config['rewrite_js']) {
                    $body = $this->jsRewriter->rewrite($body);
                }
            } elseif (stripos($contentType, 'application/json') !== false) {
                if ($this->config['rewrite_json']) {
                    $body = $this->jsonRewriter->rewrite($body);
                }
            }
        }
        
        $response['body'] = $body;
        return $response;
    }

    private function decompressBody(string $body, array $headers): string {
        $isGzip = false;
        $isDeflate = false;
        
        foreach ($headers as $header) {
            if (stripos($header, 'Content-Encoding:') === 0) {
                $encoding = strtolower(trim(substr($header, strlen('Content-Encoding:'))));
                if ($encoding === 'gzip') {
                    $isGzip = true;
                } elseif ($encoding === 'deflate') {
                    $isDeflate = true;
                }
            }
        }
        
        if ($isGzip && function_exists('gzdecode')) {
            $decoded = @gzdecode($body);
            if ($decoded !== false) {
                return $decoded;
            }
        }
        
        if ($isDeflate && function_exists('gzinflate')) {
            $decoded = @gzinflate($body);
            if ($decoded !== false) {
                return $decoded;
            }
        }
        
        return $body;
    }

    public function sendResponse(array $response): void {
        http_response_code($response['status']);
        
        if ($response['content_type']) {
            header('Content-Type: ' . $response['content_type']);
        }
        
        // Forward important headers
        foreach ($response['headers'] as $header) {
            if (stripos($header, 'Content-Type:') === 0 || 
                stripos($header, 'Content-Disposition:') === 0 ||
                stripos($header, 'Cache-Control:') === 0) {
                header($header);
            }
        }
        
        echo $response['body'];
    }
}
