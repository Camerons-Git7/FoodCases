<?php
/**
 * Codec Interface
 */

namespace Scramjet\Codec;

interface CodecInterface {
    public function encode(string $data): string;
    public function decode(string $data): string;
    public function getName(): string;
}
