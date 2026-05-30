<?php
/**
 * XOR URL Codec
 */

namespace Scramjet\Codec;

class XorCodec implements CodecInterface {
    private $key = 'scramjet';

    public function encode(string $data): string {
        $result = '';
        for ($i = 0; $i < strlen($data); $i++) {
            $result .= chr(ord($data[$i]) ^ ord($this->key[$i % strlen($this->key)]));
        }
        return base64_encode($result);
    }

    public function decode(string $data): string {
        $decoded = base64_decode($data);
        $result = '';
        for ($i = 0; $i < strlen($decoded); $i++) {
            $result .= chr(ord($decoded[$i]) ^ ord($this->key[$i % strlen($this->key)]));
        }
        return $result;
    }

    public function getName(): string {
        return 'xor';
    }
}
