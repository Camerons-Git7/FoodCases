<?php
/**
 * Scramjet Proxy - Main Entry Point
 * Advanced interception-based web proxy with modular architecture
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Codec/CodecInterface.php';
require_once __DIR__ . '/Codec/Base64Codec.php';
require_once __DIR__ . '/Codec/Rot13Codec.php';
require_once __DIR__ . '/Codec/XorCodec.php';
require_once __DIR__ . '/Codec/CodecManager.php';
require_once __DIR__ . '/Core/CookieManager.php';
require_once __DIR__ . '/Core/RequestHandler.php';
require_once __DIR__ . '/Core/ResponseProcessor.php';
require_once __DIR__ . '/Rewriter/HtmlRewriter.php';
require_once __DIR__ . '/Rewriter/CssRewriter.php';
require_once __DIR__ . '/Rewriter/JsRewriter.php';
require_once __DIR__ . '/Rewriter/JsonRewriter.php';
require_once __DIR__ . '/Injection/InterceptorScript.php';

use Scramjet\Codec\CodecManager;
use Scramjet\Core\CookieManager;
use Scramjet\Core\RequestHandler;
use Scramjet\Core\ResponseProcessor;

class ScramjetProxy {
    private $config;
    private $codecManager;
    private $cookieManager;
    private $requestHandler;
    private $responseProcessor;

    public function __construct() {
        $this->config = require __DIR__ . '/config.php';
        $this->codecManager = new CodecManager(
            $this->config['codecs'],
            $this->config['codec']
        );
        $this->cookieManager = new CookieManager();
        $this->requestHandler = new RequestHandler(
            $this->config,
            $this->codecManager,
            $this->cookieManager
        );
        
        $proxyUrl = $this->getProxyUrl();
        $this->responseProcessor = new ResponseProcessor(
            $this->config,
            $this->codecManager,
            $proxyUrl
        );
    }

    public function run() {
        $url = $this->extractUrl();
        
        if (empty($url)) {
            $this->showLanding();
            return;
        }
        
        // Decode URL if encoded
        if ($this->codecManager->isEncoded($url)) {
            $url = $this->codecManager->decode($url);
        }
        
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            http_response_code(400);
            die('Invalid URL');
        }
        
        $parsed = parse_url($url);
        $host = $parsed['host'] ?? '';
        
        if ($this->isPrivate($host)) {
            http_response_code(403);
            die('Access denied');
        }
        
        if (!function_exists('curl_init')) {
            http_response_code(500);
            die('cURL not enabled');
        }
        
        try {
            $response = $this->requestHandler->handleRequest($url);
            $processedResponse = $this->responseProcessor->processResponse($response);
            $this->responseProcessor->sendResponse($processedResponse);
        } catch (\Exception $e) {
            http_response_code(502);
            die('Proxy error: ' . $e->getMessage());
        }
    }

    private function isPrivate(string $host): bool {
        $ip = gethostbyname($host);
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
            return true;
        }
        return in_array(strtolower($host), $this->config['blocked_domains']);
    }

    private function extractUrl(): ?string {
        if (isset($_GET['url'])) {
            return $_GET['url'];
        } elseif (isset($_GET['q'])) {
            return $_GET['q'];
        }
        return null;
    }

    private function getProxyUrl(): string {
        $scheme = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on') ? 'https' : 'http';
        return $scheme . '://' . $_SERVER['HTTP_HOST'] . $_SERVER['SCRIPT_NAME'];
    }

    private function showLanding(): void {
        $host = $_SERVER['HTTP_HOST'];
        $script = $_SERVER['SCRIPT_NAME'];
        $dir = dirname($script);
        if ($dir === '/' || $dir === '\\') $dir = '';
        
        include __DIR__ . '/public/index.html';
    }
}

// Run the proxy
$proxy = new ScramjetProxy();
$proxy->run();
