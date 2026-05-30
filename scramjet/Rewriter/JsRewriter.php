<?php
/**
 * JavaScript Rewriter
 */

namespace Scramjet\Rewriter;

class JsRewriter {
    private $proxyUrl;
    private $codecManager;

    public function __construct(string $proxyUrl, $codecManager) {
        $this->proxyUrl = $proxyUrl;
        $this->codecManager = $codecManager;
    }

    public function rewrite(string $js): string {
        // Rewrite URLs in single-quoted strings
        $js = preg_replace_callback(
            '/(["\'])(https?:\/\/[^"\']+)\1/i',
            function($matches) {
                return $matches[1] . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[2]) . $matches[1];
            },
            $js
        );

        // Rewrite template literals (backtick strings)
        $js = preg_replace_callback(
            '/`([^`]*)https?:\/\/[^`]+`/i',
            function($matches) {
                $content = $matches[0];
                $content = preg_replace(
                    '/(https?:\/\/[^\s`]+)/',
                    $this->proxyUrl . '?q=' . $this->codecManager->encode('$1'),
                    $content
                );
                return $content;
            },
            $js
        );

        return $js;
    }
}
