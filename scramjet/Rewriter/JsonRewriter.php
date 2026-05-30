<?php
/**
 * JSON Rewriter
 */

namespace Scramjet\Rewriter;

class JsonRewriter {
    private $proxyUrl;
    private $codecManager;

    public function __construct(string $proxyUrl, $codecManager) {
        $this->proxyUrl = $proxyUrl;
        $this->codecManager = $codecManager;
    }

    public function rewrite(string $json): string {
        // Rewrite URLs in JSON strings
        $json = preg_replace_callback(
            '/"(https?:\/\/[^"]+)"/',
            function($matches) {
                return '"' . $this->proxyUrl . '?q=' . $this->codecManager->encode($matches[1]) . '"';
            },
            $json
        );

        return $json;
    }
}
