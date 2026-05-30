<?php
/**
 * CSS Rewriter
 */

namespace Scramjet\Rewriter;

class CssRewriter {
    private $proxyUrl;
    private $codecManager;

    public function __construct(string $proxyUrl, $codecManager) {
        $this->proxyUrl = $proxyUrl;
        $this->codecManager = $codecManager;
    }

    public function rewrite(string $css): string {
        // Rewrite url() functions
        $css = preg_replace_callback(
            '/url\(["\']?(https?:\/\/[^"\'\)]+)["\']?\)/i',
            function($matches) {
                return 'url("' . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[1]) . '")';
            },
            $css
        );

        // Rewrite @import statements
        $css = preg_replace_callback(
            '/@import\s+(?:url\()?["\']?(https?:\/\/[^"\'\)]+)["\']?\)?/i',
            function($matches) {
                return '@import url("' . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[1]) . '")';
            },
            $css
        );

        // Rewrite font-face src
        $css = preg_replace_callback(
            '/src:\s*url\(["\']?(https?:\/\/[^"\'\)]+)["\']?\)/i',
            function($matches) {
                return 'src: url("' . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[1]) . '")';
            },
            $css
        );

        return $css;
    }
}
