<?php
/**
 * Codec Manager
 */

namespace Scramjet\Codec;

class CodecManager {
    private $codecs = [];
    private $defaultCodec;

    public function __construct(array $codecNames, string $defaultCodec) {
        $this->defaultCodec = $defaultCodec;
        
        foreach ($codecNames as $name) {
            switch ($name) {
                case 'base64':
                    $this->codecs[$name] = new Base64Codec();
                    break;
                case 'rot13':
                    $this->codecs[$name] = new Rot13Codec();
                    break;
                case 'xor':
                    $this->codecs[$name] = new XorCodec();
                    break;
            }
        }
    }

    public function encode(string $data, ?string $codec = null): string {
        $codec = $codec ?? $this->defaultCodec;
        if (!isset($this->codecs[$codec])) {
            throw new \Exception("Codec '$codec' not found");
        }
        return $this->codecs[$codec]->encode($data);
    }

    public function decode(string $data, ?string $codec = null): string {
        $codec = $codec ?? $this->defaultCodec;
        if (!isset($this->codecs[$codec])) {
            throw new \Exception("Codec '$codec' not found");
        }
        return $this->codecs[$codec]->decode($data);
    }

    public function isEncoded(string $data): bool {
        return strpos($data, 'http') !== 0;
    }

    public function getDefaultCodec(): string {
        return $this->defaultCodec;
    }
}
