<?php
/**
 * HTML Rewriter
 */

namespace Scramjet\Rewriter;

class HtmlRewriter {
    private $proxyUrl;
    private $codecManager;

    public function __construct(string $proxyUrl, $codecManager) {
        $this->proxyUrl = $proxyUrl;
        $this->codecManager = $codecManager;
    }

    public function rewrite(string $html): string {
        // Rewrite href attributes
        $html = preg_replace_callback(
            '/(href=["\'])(https?:\/\/[^"\']+)(["\'])/i',
            function($matches) {
                return $matches[1] . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[2]) . $matches[3];
            },
            $html
        );

        // Rewrite src attributes
        $html = preg_replace_callback(
            '/(src=["\'])(https?:\/\/[^"\']+)(["\'])/i',
            function($matches) {
                return $matches[1] . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[2]) . $matches[3];
            },
            $html
        );

        // Rewrite action attributes
        $html = preg_replace_callback(
            '/(action=["\'])(https?:\/\/[^"\']+)(["\'])/i',
            function($matches) {
                return $matches[1] . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[2]) . $matches[3];
            },
            $html
        );

        // Rewrite content attributes (meta refresh, etc.)
        $html = preg_replace_callback(
            '/(content=["\'])(https?:\/\/[^"\']+)(["\'])/i',
            function($matches) {
                return $matches[1] . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[2]) . $matches[3];
            },
            $html
        );

        // Rewrite data-src attributes (lazy loading)
        $html = preg_replace_callback(
            '/(data-src=["\'])(https?:\/\/[^"\']+)(["\'])/i',
            function($matches) {
                return $matches[1] . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[2]) . $matches[3];
            },
            $html
        );

        // Rewrite srcset attributes
        $html = preg_replace_callback(
            '/(srcset=["\'])([^"\']+)(["\'])/i',
            function($matches) {
                $urls = explode(',', $matches[2]);
                $rewritten = [];
                foreach ($urls as $url) {
                    $url = trim($url);
                    if (preg_match('/^https?:\/\//', $url)) {
                        $parts = explode(' ', $url, 2);
                        $parts[0] = $this->proxyUrl . '?q=' . $this->codecManager->encode($parts[0]);
                        $rewritten[] = implode(' ', $parts);
                    } else {
                        $rewritten[] = $url;
                    }
                }
                return $matches[1] . implode(', ', $rewritten) . $matches[3];
            },
            $html
        );

        return $html;
    }
}
