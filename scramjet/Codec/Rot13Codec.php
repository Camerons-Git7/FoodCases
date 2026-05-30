<?php
/**
 * ROT13 URL Codec
 */

namespace Scramjet\Codec;

class Rot13Codec implements CodecInterface {
    public function encode(string $data): string {
        return str_rot13($data);
    }

    public function decode(string $data): string {
        return str_rot13($data);
    }

    public function getName(): string {
        return 'rot13';
    }
}
