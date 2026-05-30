<?php
/**
 * Base64 URL Codec
 */

namespace Scramjet\Codec;

class Base64Codec implements CodecInterface {
    public function encode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    public function decode(string $data): string {
        return base64_decode(strtr(str_pad($data, strlen($data) + (4 - strlen($data) % 4) % 4, '='), '-_', '+/'));
    }

    public function getName(): string {
        return 'base64';
    }
}
